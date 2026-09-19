import { createHmac, timingSafeEqual } from "node:crypto";

/** Server-side Razorpay settings. The key secret and webhook secret never reach the browser. */
export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  /** Null until a webhook is set up in the Razorpay dashboard; the webhook route then refuses posts. */
  webhookSecret: string | null;
}

/** What the browser needs to open Razorpay Checkout for one order. */
export interface CheckoutOrder {
  keyId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
}

/** The fields Razorpay Checkout hands the success handler. */
export interface CheckoutResult {
  orderId: string;
  paymentId: string;
  signature: string;
}

/** A payment named in a webhook event. */
export interface WebhookPayment {
  orderId: string;
  paymentId: string;
}

/** Events that mean the money was taken. Both can arrive for one payment; recording is idempotent. */
const PAID_EVENTS: readonly string[] = ["payment.captured", "order.paid"];

/** Razorpay caps an order's receipt at 40 characters. */
const MAX_RECEIPT_LENGTH = 40;

/**
 * Reads the Razorpay keys. Payments are off when neither key is set; one key without the
 * other is a broken deploy, so it throws.
 */
export function razorpayConfig(env: Record<string, string | undefined>): RazorpayConfig | null {
  const keyId = env.RAZORPAY_KEY_ID?.trim() ?? "";
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim() ?? "";
  if (!keyId && !keySecret) return null;
  if (!keyId || !keySecret) {
    throw new Error("Set both RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, or neither to turn payments off.");
  }
  return { keyId, keySecret, webhookSecret: env.RAZORPAY_WEBHOOK_SECRET?.trim() || null };
}

function hmacHex(message: string, secret: string): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

/** Compares two hex signatures in constant time. */
function signaturesMatch(expected: string, received: string): boolean {
  const expectedBytes = Buffer.from(expected, "utf8");
  const receivedBytes = Buffer.from(received, "utf8");
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}

/** True when Checkout's signature is HMAC-SHA256 of "order_id|payment_id" under the key secret. */
export function isCheckoutSignatureValid(result: CheckoutResult, keySecret: string): boolean {
  return signaturesMatch(hmacHex(`${result.orderId}|${result.paymentId}`, keySecret), result.signature);
}

/** True when X-Razorpay-Signature is HMAC-SHA256 of the raw body under the webhook secret. */
export function isWebhookSignatureValid(rawBody: string, signature: string, webhookSecret: string): boolean {
  return signaturesMatch(hmacHex(rawBody, webhookSecret), signature);
}

/** The payment a webhook reports as paid, or null for any other event. */
export function paidPaymentFromWebhook(rawBody: string): WebhookPayment | null {
  const event = JSON.parse(rawBody) as {
    event?: unknown;
    payload?: { payment?: { entity?: { id?: unknown; order_id?: unknown } } };
  };
  if (typeof event.event !== "string" || !PAID_EVENTS.includes(event.event)) return null;
  const payment = event.payload?.payment?.entity;
  if (typeof payment?.id !== "string" || typeof payment.order_id !== "string") {
    throw new Error(`Razorpay ${event.event} webhook has no payment id and order id.`);
  }
  return { orderId: payment.order_id, paymentId: payment.id };
}

/** The order receipt: the entry id, cut to Razorpay's limit. */
export function orderReceipt(entryId: string): string {
  return entryId.slice(0, MAX_RECEIPT_LENGTH);
}
