import { getDb } from "@/db/client";
import { applyRazorpayWebhook } from "@/db/payments";
import { razorpayConfig } from "@/lib/razorpay";

/**
 * Razorpay posts payment events here, so an entry is marked paid even when the player
 * closes the page before Checkout reports back. Set this URL and its secret in the
 * Razorpay dashboard under Webhooks, with the payment.captured and order.paid events.
 */
export async function POST(request: Request): Promise<Response> {
  // The signature covers the exact bytes Razorpay sent, so read the body as text.
  const rawBody = await request.text();
  const status = applyRazorpayWebhook(getDb(), {
    rawBody,
    signature: request.headers.get("x-razorpay-signature"),
    webhookSecret: razorpayConfig(process.env)?.webhookSecret ?? null,
  });
  return new Response(null, { status });
}
