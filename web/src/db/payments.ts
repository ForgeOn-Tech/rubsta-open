import { and, eq } from "drizzle-orm";

import type { Database } from "./draws";
import { getEventFees } from "./fees";
import { entries, payments, tournaments, type Entry, type Tournament } from "./schema";
import { registrationPrice } from "@/lib/registration-pricing";
import { isPayable } from "@/lib/entry-status";
import { isWebhookSignatureValid, paidPaymentFromWebhook, type WebhookPayment } from "@/lib/razorpay";

/** The player cannot pay for this entry. Its message is for the player. */
export class PaymentRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentRejectedError";
  }
}

/** An entry the signed-in player can pay for, with the fee it costs. */
export interface PayableEntry {
  entry: Entry;
  entries: Entry[];
  tournament: Tournament;
  feeCents: number;
}

/** What happened to a confirmed payment. */
export type PaymentRecord = "recorded" | "already recorded";

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAVAILABLE = 503;

/** The player's own entry and its fee, when it still waits for payment. */
export function getPayableEntry(database: Database, entryId: string, userId: string): PayableEntry {
  const row = database
    .select({ entry: entries, tournament: tournaments })
    .from(entries)
    .innerJoin(tournaments, eq(entries.tournamentId, tournaments.id))
    .where(and(eq(entries.id, entryId), eq(entries.userId, userId)))
    .get();
  if (!row) throw new Error(`Entry ${entryId} does not belong to user ${userId}.`);
  if (row.entry.status === "paid") throw new PaymentRejectedError("This entry is already paid.");
  if (!isPayable(row.entry.status)) throw new PaymentRejectedError("This entry was cancelled, so it cannot be paid.");
  const bundled = row.entry.bundleId
    ? database.select().from(entries).where(and(eq(entries.bundleId, row.entry.bundleId), eq(entries.userId, userId))).all()
    : [row.entry];
  if (bundled.length === 0 || bundled.some(entry => entry.status === "paid" || !isPayable(entry.status))) {
    throw new PaymentRejectedError("This entry is no longer available to pay.");
  }
  const feeCents = registrationPrice(getEventFees(database, row.tournament.id), bundled.map(entry => entry.category));
  if (feeCents <= 0) throw new PaymentRejectedError("This event has no entry fee to pay.");
  return { ...row, entries: bundled, feeCents };
}

/** Stores a new Razorpay order against an entry, before Checkout opens. */
export function recordOrder(
  database: Database,
  order: { entryId: string; userId: string; orderId: string; amountCents: number; currency: string },
): void {
  database.insert(payments).values(order).run();
}

/**
 * Marks an order paid and, if the entry still waits for payment, marks the entry paid with
 * Razorpay's payment id. Safe to call twice: Checkout and the webhook both report a payment.
 * An entry cancelled or already paid keeps its status, and the payment row shows the money
 * to refund.
 */
export function recordPayment(database: Database, paid: WebhookPayment): PaymentRecord {
  return database.transaction((tx) => {
    const payment = tx.select().from(payments).where(eq(payments.orderId, paid.orderId)).get();
    if (!payment) throw new Error(`Razorpay order ${paid.orderId} is not an order this app created.`);
    if ((paid.amountCents !== undefined && paid.amountCents !== payment.amountCents) ||
        (paid.currency !== undefined && paid.currency !== payment.currency)) {
      throw new PaymentRejectedError("Payment amount or currency does not match the stored order.");
    }
    if (payment.status === "paid") {
      if (payment.paymentId !== paid.paymentId) {
        throw new Error(
          `Razorpay order ${paid.orderId} is already paid by ${payment.paymentId}, not ${paid.paymentId}.`,
        );
      }
      return "already recorded";
    }

    tx.update(payments)
      .set({ status: "paid", paymentId: paid.paymentId, paidAt: Date.now() })
      .where(eq(payments.id, payment.id))
      .run();
    const entry = tx.select().from(entries).where(eq(entries.id, payment.entryId)).get();
    if (!entry) throw new Error(`Payment ${payment.id} names entry ${payment.entryId}, which does not exist.`);
    if (isPayable(entry.status)) {
      const paidEntries = entry.bundleId
        ? tx.select().from(entries).where(eq(entries.bundleId, entry.bundleId)).all()
        : [entry];
      if (paidEntries.some(item => !isPayable(item.status))) {
        console.warn(`Payment ${paid.paymentId} arrived for a changed bundle; refund it in Razorpay.`);
      } else {
        for (const item of paidEntries) tx.update(entries).set({ status: "paid", paymentRef: paid.paymentId }).where(eq(entries.id, item.id)).run();
      }
    } else {
      console.warn(
        `Payment ${paid.paymentId} arrived for entry ${entry.id}, which is ${entry.status}; refund it in Razorpay.`,
      );
    }
    return "recorded";
  });
}

/** True when this app created the order. Webhooks also report payments made outside the app. */
function isKnownOrder(database: Database, orderId: string): boolean {
  return database.select({ id: payments.id }).from(payments).where(eq(payments.orderId, orderId)).get() !== undefined;
}

/**
 * Handles one Razorpay webhook post and returns the HTTP status to answer with. Razorpay
 * retries anything other than 2xx, so only a bad signature or missing setup is refused.
 */
export function applyRazorpayWebhook(
  database: Database,
  post: { rawBody: string; signature: string | null; webhookSecret: string | null },
): number {
  if (!post.webhookSecret) {
    console.error("Razorpay webhook received, but RAZORPAY_WEBHOOK_SECRET is not set.");
    return HTTP_UNAVAILABLE;
  }
  if (!post.signature || !isWebhookSignatureValid(post.rawBody, post.signature, post.webhookSecret)) {
    return HTTP_BAD_REQUEST;
  }
  let paid: WebhookPayment | null;
  try { paid = paidPaymentFromWebhook(post.rawBody); }
  catch { return HTTP_BAD_REQUEST; }
  if (!paid) return HTTP_OK;
  if (!isKnownOrder(database, paid.orderId)) {
    console.warn(`Razorpay webhook for order ${paid.orderId}, which this app did not create; ignored.`);
    return HTTP_OK;
  }
  try { recordPayment(database, paid); }
  catch (error) {
    if (error instanceof PaymentRejectedError) return HTTP_BAD_REQUEST;
    throw error;
  }
  return HTTP_OK;
}
