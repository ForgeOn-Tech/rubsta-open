// @vitest-environment node
import SQLite from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { SEED_TOURNAMENT } from "@/db/seed";
import { recordOrder, recordPayment } from "@/db/payments";
import { deliverNextPaymentEmail, paymentEmailConfig } from "../payment-email-delivery";

let sqlite: SQLite.Database;
let db: ReturnType<typeof drizzle<typeof schema>>;
const config = { apiKey: "fake-test-key" };
beforeEach(() => {
  sqlite = new SQLite(":memory:"); sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema }); migrate(db, { migrationsFolder: "./drizzle" });
  db.insert(schema.users).values({ id: "u", email: "payer@example.com" }).run();
  db.insert(schema.tournaments).values({ id: "t", ...SEED_TOURNAMENT }).run();
  db.insert(schema.entries).values({ id: "e", userId: "u", tournamentId: "t", category: "OS" }).run();
  recordOrder(db, { entryId: "e", userId: "u", orderId: "o", amountCents: 300000, currency: "INR" });
  recordPayment(db, { orderId: "o", paymentId: "p", amountCents: 300000, currency: "INR" });
});
afterEach(() => sqlite.close());
const row = () => db.select().from(schema.paymentEmails).get()!;
it("requires explicit enablement and a key", () => {
  expect(paymentEmailConfig({})).toBeNull();
  expect(paymentEmailConfig({ RESEND_API_KEY: "fake" })).toBeNull();
  expect(paymentEmailConfig({ PAYMENT_EMAILS_ENABLED: "true" })).toBeNull();
  expect(paymentEmailConfig({ PAYMENT_EMAILS_ENABLED: "true", RESEND_API_KEY: "fake" })).toEqual({ apiKey: "fake" });
});
it("sends once from info@rubstaopen.com to the payer", async () => {
  const send = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: "email-1" }));
  expect(await deliverNextPaymentEmail(db, config, send)).toBe("accepted");
  expect(await deliverNextPaymentEmail(db, config, send)).toBe("idle");
  expect(send).toHaveBeenCalledTimes(1);
  expect(JSON.parse(String(send.mock.calls[0][1]!.body))).toMatchObject({
    to: ["payer@example.com"], from: "Rubsta Open <info@rubstaopen.com>", reply_to: "info@rubstaopen.com",
    html: expect.stringContaining('href="https://www.rubstaopen.com/avatar"'),
    text: expect.stringContaining("Manvir Singh"),
  });
  expect(row().providerId).toBe("email-1");
});
it("retries timeouts with identical content and duplicate protection", async () => {
  const now = Date.now();
  const send = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce(Response.json({ id: "email-1" }));
  expect(await deliverNextPaymentEmail(db, config, send, now)).toBe("retry");
  expect(await deliverNextPaymentEmail(db, config, send, now + 1000)).toBe("idle");
  expect(await deliverNextPaymentEmail(db, config, send, now + 60001)).toBe("accepted");
  expect(send.mock.calls[0][1]?.body).toEqual(send.mock.calls[1][1]?.body);
  expect(send.mock.calls[0][1]?.headers).toEqual(send.mock.calls[1][1]?.headers);
  expect(db.select().from(schema.payments).get()?.status).toBe("paid");
});
it("does not send an in-flight message twice", async () => {
  let resolve!: (value: Response) => void;
  const send = vi.fn<typeof fetch>().mockImplementation(() => new Promise(r => { resolve = r; }));
  const first = deliverNextPaymentEmail(db, config, send);
  expect(await deliverNextPaymentEmail(db, config, send)).toBe("idle");
  resolve(Response.json({ id: "email-1" }));
  expect(await first).toBe("accepted");
  expect(send).toHaveBeenCalledTimes(1);
});
it("holds uncertain sends before provider duplicate protection expires", async () => {
  const now = Date.now(); const send = vi.fn<typeof fetch>().mockRejectedValue(new Error("timeout"));
  await deliverNextPaymentEmail(db, config, send, now);
  expect(await deliverNextPaymentEmail(db, config, send, now + 24 * 3600000)).toBe("review");
  expect(send).toHaveBeenCalledTimes(1); expect(row().needsReview).toBe(true);
});
it("retries rate limits and holds permanent errors without claiming sent", async () => {
  const now = Date.now();
  const send = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("limit", { status: 429 })).mockResolvedValueOnce(new Response("unverified", { status: 403 }));
  expect(await deliverNextPaymentEmail(db, config, send, now)).toBe("retry");
  expect(await deliverNextPaymentEmail(db, config, send, now + 60001)).toBe("review");
  expect(row().acceptedAt).toBeNull();
  expect(row().lastError).toBe("Resend returned HTTP 403.");
});
it("does not report acceptance for a malformed success response", async () => {
  expect(await deliverNextPaymentEmail(db, config, vi.fn<typeof fetch>().mockResolvedValue(Response.json({})))).toBe("retry");
  expect(row().acceptedAt).toBeNull();
});
