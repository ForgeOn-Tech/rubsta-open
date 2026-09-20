// @vitest-environment node
import { createHmac } from "node:crypto";

import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, describe, expect, it, vi } from "vitest";

import { saveEventFees } from "@/db/fees";
import {
  PaymentRejectedError,
  applyRazorpayWebhook,
  getPayableEntry,
  recordOrder,
  recordPayment,
} from "@/db/payments";
import * as schema from "@/db/schema";
import { SEED_FEES, SEED_TOURNAMENT } from "@/db/seed";

const TOURNAMENT_ID = "tournament-1";
const PLAYER = "player";
const WEBHOOK_SECRET = "whsec";

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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getPayableEntry", () => {
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
