import type { RazorpayConfig } from "@/lib/razorpay";

const ORDERS_URL = "https://api.razorpay.com/v1/orders";
const PAYMENTS_URL = "https://api.razorpay.com/v1/payments";
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;
const REQUEST_TIMEOUT_MS = 10_000;
const FIRST_SERVER_ERROR = 500;

/** Razorpay refused the request. Not retried: the same request fails the same way. */
export class RazorpayRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RazorpayRequestError";
  }
}

export interface OrderRequest {
  amountCents: number;
  currency: string;
  receipt: string;
  notes: Record<string, string>;
}

export interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  captured: boolean;
}

/** Read the provider's state; a signed Checkout response may still be only authorized. */
export async function fetchRazorpayPayment(config: RazorpayConfig, paymentId: string): Promise<RazorpayPayment> {
  if (!/^pay_[a-zA-Z0-9]+$/.test(paymentId)) throw new RazorpayRequestError("Invalid payment reference.");
  const credentials = Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64");
  const response = await fetch(`${PAYMENTS_URL}/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Basic ${credentials}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new RazorpayRequestError(`Payment lookup returned HTTP ${response.status}.`);
  const payment = await response.json() as Partial<RazorpayPayment>;
  if (payment.id !== paymentId || typeof payment.order_id !== "string" ||
      !Number.isSafeInteger(payment.amount) || typeof payment.currency !== "string" ||
      typeof payment.status !== "string" || typeof payment.captured !== "boolean") {
    throw new RazorpayRequestError("Invalid payment lookup response.");
  }
  return payment as RazorpayPayment;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function postOrder(config: RazorpayConfig, order: OrderRequest): Promise<string> {
  const credentials = Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64");
  const response = await fetch(ORDERS_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: order.amountCents,
      currency: order.currency,
      receipt: order.receipt,
      notes: order.notes,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = await response.text();
  if (response.status >= FIRST_SERVER_ERROR) {
    throw new Error(`Razorpay order request failed with HTTP ${response.status}: ${body}`);
  }
  if (!response.ok) {
    throw new RazorpayRequestError(`Razorpay refused the order with HTTP ${response.status}: ${body}`);
  }
  const created = JSON.parse(body) as { id?: unknown };
  if (typeof created.id !== "string") throw new Error(`Razorpay order response has no id: ${body}`);
  return created.id;
}

/**
 * Creates a Razorpay order and returns its id. Network failures and server errors are
 * retried with a warning; the last error is raised.
 */
export async function createRazorpayOrder(config: RazorpayConfig, order: OrderRequest): Promise<string> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await postOrder(config, order);
    } catch (error) {
      if (error instanceof RazorpayRequestError) throw error;
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        console.warn(`Razorpay order for receipt ${order.receipt} failed (attempt ${attempt}); retrying.`, error);
        await wait(RETRY_DELAY_MS * attempt);
      }
    }
  }
  throw lastError;
}
