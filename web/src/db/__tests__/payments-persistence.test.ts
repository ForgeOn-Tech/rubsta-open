// @vitest-environment node
import { createHmac } from "node:crypto";

import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { saveEventFees } from "@/db/fees";
import { listPlayedCategories } from "@/db/partners";
import {
  SelectionRejectedError,
  bundleForSelection,
  cancelSelection,
  registrationState,
  topUpBase,
} from "@/db/registration";
import {
  PaymentRejectedError,
  applyRazorpayWebhook,
  getPayableEntry,
  recordOrder,
  recordPayment,
} from "@/db/payments";
import * as schema from "@/db/schema";
import { SEED_FEES, SEED_TOURNAMENT } from "@/db/seed";
import { isUniqueViolation } from "@/lib/entries";

const TOURNAMENT_ID = "tournament-1";
const PLAYER = "player";
const WEBHOOK_SECRET = "whsec";
const EARLY_BIRD_DAY = new Date("2026-09-30T12:00:00+05:30");
const AFTER_EARLY_BIRD = new Date("2026-10-01T12:00:00+05:30");

function setup() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const database = drizzle(sqlite, { schema });
  migrate(database, { migrationsFolder: "./drizzle" });
  database.insert(schema.tournaments).values({ id: TOURNAMENT_ID, ...SEED_TOURNAMENT }).run();
  saveEventFees(database, TOURNAMENT_ID, SEED_FEES);
  database.insert(schema.users).values({ id: PLAYER, email: "player@example.com", name: null }).run();
  return database;
}

type TestDatabase = ReturnType<typeof setup>;

function addEntry(
  database: TestDatabase,
  id: string,
  category: schema.Category,
  status: schema.EntryStatus,
): void {
  database.insert(schema.entries).values({ id, userId: PLAYER, tournamentId: TOURNAMENT_ID, category, status }).run();
}

function addOrder(database: TestDatabase, entryId: string, orderId: string): void {
  recordOrder(database, { entryId, userId: PLAYER, orderId, amountCents: 300000, currency: "INR" });
}

function entryOf(database: TestDatabase, id: string) {
  return database.select().from(schema.entries).where(eq(schema.entries.id, id)).get();
}

function paymentOf(database: TestDatabase, orderId: string) {
  return database.select().from(schema.payments).where(eq(schema.payments.orderId, orderId)).get();
}

function signedWebhook(event: string, payment: { id: string; order_id: string; amount?: number; currency?: string; captured?: boolean }) {
  const rawBody = JSON.stringify({ event, payload: { payment: { entity: { amount: 300000, currency: "INR", status: "captured", captured: true, ...payment } } } });
  const signature = createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  return { rawBody, signature, webhookSecret: WEBHOOK_SECRET };
}

/** Adds entries the way the entry form does, including a top-up bundle when one applies. */
function addSelection(database: TestDatabase, ids: readonly string[], categories: readonly schema.Category[]): void {
  const bundleId = bundleForSelection(database, PLAYER, TOURNAMENT_ID, categories);
  database.insert(schema.entries).values(categories.map((category, index) => ({
    id: ids[index], userId: PLAYER, tournamentId: TOURNAMENT_ID, bundleId, category, status: "submitted" as const,
  }))).run();
}

/** Pays the entry's checkout at the price it shows, as Razorpay would. */
function payCheckout(database: TestDatabase, entryId: string, paymentId: string): number {
  const { feeCents } = getPayableEntry(database, entryId, PLAYER);
  recordOrder(database, { entryId, userId: PLAYER, orderId: `order_${paymentId}`, amountCents: feeCents, currency: "INR" });
  recordPayment(database, { orderId: `order_${paymentId}`, paymentId, amountCents: feeCents, currency: "INR" });
  return feeCents;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(EARLY_BIRD_DAY);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("getPayableEntry", () => {
  it("lets a paid player pay for another event at its single price", () => {
    const database = setup();
    addEntry(database, "paid", "OS", "paid");
    addEntry(database, "unpaid", "S40", "submitted");

    expect(registrationState(database, PLAYER, TOURNAMENT_ID)).toEqual({ paid: true, pendingId: "unpaid" });
    expect(getPayableEntry(database, "unpaid", PLAYER).feeCents).toBe(280000);
  });

  it("resumes an unpaid registration after a failed checkout", () => {
    const database = setup();
    addEntry(database, "pending", "OS", "submitted");
    expect(registrationState(database, PLAYER, TOURNAMENT_ID)).toEqual({ paid: false, pendingId: "pending" });
    expect(getPayableEntry(database, "pending", PLAYER).entry.id).toBe("pending");
  });
  it("charges an approved two-event bundle once with the ₹500 early-bird offer", () => {
    const database = setup();
    database.insert(schema.entryBundles).values({ id: "bundle-1", userId: PLAYER, tournamentId: TOURNAMENT_ID }).run();
    database.insert(schema.entries).values([
      { id: "os", userId: PLAYER, tournamentId: TOURNAMENT_ID, bundleId: "bundle-1", category: "OS", status: "submitted" },
      { id: "od", userId: PLAYER, tournamentId: TOURNAMENT_ID, bundleId: "bundle-1", category: "OD", status: "submitted" },
    ]).run();

    const payable = getPayableEntry(database, "od", PLAYER);
    expect(payable.feeCents).toBe(650000);
    expect(payable.entries.map(entry => entry.id).sort()).toEqual(["od", "os"]);
  });
  it("applies the early-bird discount to individual events", () => {
    const database = setup();
    addEntry(database, "singles", "W30", "submitted");
    addEntry(database, "doubles", "OD", "confirmed");

    expect(getPayableEntry(database, "singles", PLAYER).feeCents).toBe(230000);
    expect(getPayableEntry(database, "doubles", PLAYER).feeCents).toBe(380000);
  });

  it("refuses an entry that is paid or cancelled", () => {
    const database = setup();
    addEntry(database, "paid", "OS", "paid");
    addEntry(database, "cancelled", "U15", "cancelled");

    expect(() => getPayableEntry(database, "paid", PLAYER)).toThrow(
      new PaymentRejectedError("This entry is already paid."),
    );
    expect(() => getPayableEntry(database, "cancelled", PLAYER)).toThrow(
      new PaymentRejectedError("This entry was cancelled, so it cannot be paid."),
    );
  });

  it("refuses an event with no fee", () => {
    const database = setup();
    saveEventFees(database, TOURNAMENT_ID, { ...SEED_FEES, S40: 0 });
    addEntry(database, "free", "S40", "submitted");

    expect(() => getPayableEntry(database, "free", PLAYER)).toThrow("This event has no entry fee to pay.");
  });

  it("does not show another player's entry", () => {
    const database = setup();
    addEntry(database, "mine", "OS", "submitted");

    expect(() => getPayableEntry(database, "mine", "someone-else")).toThrow(
      "Entry mine does not belong to user someone-else.",
    );
  });
});

describe("adding a category after payment", () => {
  it("charges a single event that completes a combo only the top-up, and keeps the first payment", () => {
    const database = setup();
    addSelection(database, ["os"], ["OS"]);
    payCheckout(database, "os", "pay_os");

    addSelection(database, ["od"], ["OD"]);
    const payable = getPayableEntry(database, "od", PLAYER);
    payCheckout(database, "od", "pay_od");

    // OS + OD combo ₹6,500 less ₹2,800 paid for OS.
    expect(payable).toMatchObject({ feeCents: 370000, amountPaidCents: 280000 });
    expect(payable.entries.map(entry => entry.id)).toEqual(["od"]);
    expect(payable.paidEntries.map(entry => entry.id)).toEqual(["os"]);
    expect(entryOf(database, "os")).toMatchObject({ status: "paid", paymentRef: "pay_os" });
    expect(entryOf(database, "od")).toMatchObject({ status: "paid", paymentRef: "pay_od" });
  });

  it("refuses a combo that overlaps an event already paid for", () => {
    const database = setup();
    addSelection(database, ["os"], ["OS"]);
    payCheckout(database, "os", "pay_os");

    const error = (() => {
      try { addSelection(database, ["os-2", "od"], ["OS", "OD"]); }
      catch (caught) { return caught; }
      return null;
    })();

    expect(listPlayedCategories(database, PLAYER)).toContain("OS");
    expect(isUniqueViolation(error)).toBe(true);
  });

  it("charges the single price after a paid combo", () => {
    const database = setup();
    addSelection(database, ["os", "od"], ["OS", "OD"]);
    payCheckout(database, "os", "pay_combo");

    addSelection(database, ["w30"], ["W30"]);

    expect(entryOf(database, "w30")?.bundleId).toBeNull();
    expect(getPayableEntry(database, "w30", PLAYER).feeCents).toBe(230000);
  });

  it("gives the combo discount once per paid event", () => {
    const database = setup();
    addSelection(database, ["od"], ["OD"]);
    payCheckout(database, "od", "pay_od");
    addSelection(database, ["os"], ["OS"]);
    // OS + OD combo ₹6,500 less ₹3,800 paid for OD.
    expect(payCheckout(database, "os", "pay_os")).toBe(270000);

    addSelection(database, ["s40"], ["S40"]);

    expect(entryOf(database, "s40")?.bundleId).toBeNull();
    expect(getPayableEntry(database, "s40", PLAYER).feeCents).toBe(280000);
  });

  it("caps the top-up at the single price once early bird ends", () => {
    const database = setup();
    addSelection(database, ["os"], ["OS"]);
    payCheckout(database, "os", "pay_os");
    vi.setSystemTime(AFTER_EARLY_BIRD);

    addSelection(database, ["od"], ["OD"]);

    // Combo ₹7,000 less ₹2,800 is ₹4,200; the single price is ₹4,000.
    expect(getPayableEntry(database, "od", PLAYER).feeCents).toBe(400000);
  });

  it("charges the single price when the paid event was marked paid by hand", () => {
    const database = setup();
    addEntry(database, "os", "OS", "paid");
    database.update(schema.entries).set({ paymentRef: "manual" }).where(eq(schema.entries.id, "os")).run();

    addSelection(database, ["od"], ["OD"]);

    expect(entryOf(database, "od")?.bundleId).toBeNull();
    expect(getPayableEntry(database, "od", PLAYER).feeCents).toBe(380000);
  });

  it("lets the player enter an event again after the organiser cancels the paid entry", () => {
    const database = setup();
    addSelection(database, ["os"], ["OS"]);
    payCheckout(database, "os", "pay_os");
    database.update(schema.entries).set({ status: "cancelled" }).where(eq(schema.entries.id, "os")).run();

    addSelection(database, ["os-again"], ["OS"]);

    expect(listPlayedCategories(database, PLAYER)).toEqual(["OS"]);
    expect(getPayableEntry(database, "os-again", PLAYER).feeCents).toBe(280000);
  });
});

describe("cancelSelection", () => {
  it("cancels an unpaid combo so the player can choose one event instead", () => {
    const database = setup();
    addSelection(database, ["os", "od"], ["OS", "OD"]);

    cancelSelection(database, "od", PLAYER);
    addSelection(database, ["os-only"], ["OS"]);

    expect(entryOf(database, "os")?.status).toBe("cancelled");
    expect(entryOf(database, "od")?.status).toBe("cancelled");
    expect(registrationState(database, PLAYER, TOURNAMENT_ID).pendingId).toBe("os-only");
    expect(getPayableEntry(database, "os-only", PLAYER).feeCents).toBe(280000);
  });

  it("cancels only the unpaid top-up and frees the paid event for another top-up", () => {
    const database = setup();
    addSelection(database, ["os"], ["OS"]);
    payCheckout(database, "os", "pay_os");
    addSelection(database, ["od"], ["OD"]);

    cancelSelection(database, "od", PLAYER);

    expect(entryOf(database, "od")?.status).toBe("cancelled");
    expect(entryOf(database, "os")).toMatchObject({ status: "paid", paymentRef: "pay_os", bundleId: null });
    expect(topUpBase(database, PLAYER, TOURNAMENT_ID, "OD")?.entry.id).toBe("os");
  });

  it("refuses a paid entry and another player's entry", () => {
    const database = setup();
    addSelection(database, ["os"], ["OS"]);
    payCheckout(database, "os", "pay_os");
    addSelection(database, ["od"], ["OD"]);

    expect(() => cancelSelection(database, "os", PLAYER)).toThrow(SelectionRejectedError);
    expect(() => cancelSelection(database, "od", "someone-else")).toThrow(
      "Entry od does not belong to user someone-else.",
    );
    expect(entryOf(database, "od")?.status).toBe("submitted");
  });

  it("refuses once entries close", () => {
    const database = setup();
    addSelection(database, ["os"], ["OS"]);
    vi.setSystemTime(new Date("2026-10-16T12:00:00+05:30"));

    expect(() => cancelSelection(database, "os", PLAYER)).toThrow(
      new SelectionRejectedError("Entries are closed, so this selection cannot be changed."),
    );
    expect(entryOf(database, "os")?.status).toBe("submitted");
  });

  it("refuses a combo with an event in a published draw", () => {
    const database = setup();
    addSelection(database, ["os", "od"], ["OS", "OD"]);
    database.insert(schema.draws).values({ id: "draw-os", tournamentId: TOURNAMENT_ID, category: "OS", status: "published", size: 2 }).run();
    database.insert(schema.drawSlots).values({ drawId: "draw-os", position: 1, entryId: "os" }).run();

    expect(() => cancelSelection(database, "od", PLAYER)).toThrow(
      new SelectionRejectedError("This entry is in a published draw, so it cannot be changed."),
    );
    expect(entryOf(database, "od")?.status).toBe("submitted");
  });

  it("keeps a cancelled top-up cancelled when its payment arrives late", () => {
    const database = setup();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    addSelection(database, ["os"], ["OS"]);
    payCheckout(database, "os", "pay_os");
    addSelection(database, ["od"], ["OD"]);
    recordOrder(database, { entryId: "od", userId: PLAYER, orderId: "order_late", amountCents: 370000, currency: "INR" });

    cancelSelection(database, "od", PLAYER);
    recordPayment(database, { orderId: "order_late", paymentId: "pay_late", amountCents: 370000, currency: "INR" });

    expect(entryOf(database, "od")).toMatchObject({ status: "cancelled", paymentRef: null });
    expect(entryOf(database, "os")).toMatchObject({ status: "paid", paymentRef: "pay_os" });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("refund it in Razorpay"));
  });
});

describe("recordPayment", () => {
  it("marks every entry in a paid bundle with the same payment reference", () => {
    const database = setup();
    database.insert(schema.entryBundles).values({ id: "bundle-1", userId: PLAYER, tournamentId: TOURNAMENT_ID }).run();
    database.insert(schema.entries).values([
      { id: "os", userId: PLAYER, tournamentId: TOURNAMENT_ID, bundleId: "bundle-1", category: "OS", status: "submitted" },
      { id: "od", userId: PLAYER, tournamentId: TOURNAMENT_ID, bundleId: "bundle-1", category: "OD", status: "submitted" },
    ]).run();
    recordOrder(database, { entryId: "os", userId: PLAYER, orderId: "order_combo", amountCents: 650000, currency: "INR" });

    recordPayment(database, { orderId: "order_combo", paymentId: "pay_combo", amountCents: 650000, currency: "INR" });

    expect(entryOf(database, "os")).toMatchObject({ status: "paid", paymentRef: "pay_combo" });
    expect(entryOf(database, "od")).toMatchObject({ status: "paid", paymentRef: "pay_combo" });
  });
  it("marks the order and the entry paid with Razorpay's payment id", () => {
    const database = setup();
    addEntry(database, "e1", "OS", "submitted");
    addOrder(database, "e1", "order_1");

    expect(recordPayment(database, { orderId: "order_1", paymentId: "pay_1" })).toBe("recorded");

    expect(entryOf(database, "e1")).toMatchObject({ status: "paid", paymentRef: "pay_1" });
    expect(paymentOf(database, "order_1")).toMatchObject({ status: "paid", paymentId: "pay_1" });
  });

  it("records a payment once when Checkout and the webhook both report it", () => {
    const database = setup();
    addEntry(database, "e1", "OS", "submitted");
    addOrder(database, "e1", "order_1");

    recordPayment(database, { orderId: "order_1", paymentId: "pay_1" });

    expect(recordPayment(database, { orderId: "order_1", paymentId: "pay_1" })).toBe("already recorded");
    expect(() => recordPayment(database, { orderId: "order_1", paymentId: "pay_2" })).toThrow(
      "Razorpay order order_1 is already paid by pay_1, not pay_2.",
    );
  });

  it("keeps a cancelled entry cancelled and flags the payment for a refund", () => {
    const database = setup();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    addEntry(database, "e1", "OS", "submitted");
    addOrder(database, "e1", "order_1");
    database.update(schema.entries).set({ status: "cancelled" }).where(eq(schema.entries.id, "e1")).run();

    recordPayment(database, { orderId: "order_1", paymentId: "pay_1" });

    expect(entryOf(database, "e1")).toMatchObject({ status: "cancelled", paymentRef: null });
    expect(paymentOf(database, "order_1")).toMatchObject({ status: "paid" });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("refund it in Razorpay"));
  });

  it("keeps the first payment when a second order for the same entry is paid", () => {
    const database = setup();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    addEntry(database, "e1", "OS", "submitted");
    addOrder(database, "e1", "order_1");
    addOrder(database, "e1", "order_2");

    recordPayment(database, { orderId: "order_1", paymentId: "pay_1" });
    recordPayment(database, { orderId: "order_2", paymentId: "pay_2" });

    expect(entryOf(database, "e1")).toMatchObject({ status: "paid", paymentRef: "pay_1" });
    expect(paymentOf(database, "order_2")).toMatchObject({ status: "paid", paymentId: "pay_2" });
  });

  it("refuses an order this app did not create", () => {
    const database = setup();

    expect(() => recordPayment(database, { orderId: "order_x", paymentId: "pay_1" })).toThrow(
      "Razorpay order order_x is not an order this app created.",
    );
  });
});

describe("applyRazorpayWebhook", () => {
  it.each([{ amount: 1 }, { currency: "USD" }, { captured: false }])("rejects a signed payment with incorrect details: %j", (override) => {
    const database = setup();
    addEntry(database, "e1", "OS", "submitted");
    addOrder(database, "e1", "order_1");
    expect(applyRazorpayWebhook(database, signedWebhook("payment.captured", { id: "pay_1", order_id: "order_1", ...override }))).toBe(400);
    expect(entryOf(database, "e1")?.status).toBe("submitted");
    expect(paymentOf(database, "order_1")?.status).toBe("created");
  });

  it("marks the entry paid for a signed payment.captured event", () => {
    const database = setup();
    addEntry(database, "e1", "OS", "submitted");
    addOrder(database, "e1", "order_1");

    const status = applyRazorpayWebhook(database, signedWebhook("payment.captured", { id: "pay_1", order_id: "order_1" }));

    expect(status).toBe(200);
    expect(entryOf(database, "e1")).toMatchObject({ status: "paid", paymentRef: "pay_1" });
  });

  it("refuses a missing or wrong signature and changes nothing", () => {
    const database = setup();
    addEntry(database, "e1", "OS", "submitted");
    addOrder(database, "e1", "order_1");
    const post = signedWebhook("payment.captured", { id: "pay_1", order_id: "order_1" });

    expect(applyRazorpayWebhook(database, { ...post, signature: null })).toBe(400);
    expect(applyRazorpayWebhook(database, { ...post, signature: "0".repeat(64) })).toBe(400);
    expect(entryOf(database, "e1")).toMatchObject({ status: "submitted" });
  });

  it("answers 503 until the webhook secret is set", () => {
    const database = setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const post = signedWebhook("payment.captured", { id: "pay_1", order_id: "order_1" });

    expect(applyRazorpayWebhook(database, { ...post, webhookSecret: null })).toBe(503);
  });

  it("acknowledges other events and orders from outside the app without recording them", () => {
    const database = setup();
    vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(applyRazorpayWebhook(database, signedWebhook("payment.failed", { id: "pay_1", order_id: "order_1" }))).toBe(
      200,
    );
    expect(applyRazorpayWebhook(database, signedWebhook("order.paid", { id: "pay_1", order_id: "order_x" }))).toBe(200);
    expect(database.select().from(schema.payments).all()).toEqual([]);
  });
});
