import { getDb } from "@/db/client";
import { deliverNextPaymentEmail, paymentEmailConfig } from "./payment-email-delivery";

const state = globalThis as typeof globalThis & { paymentEmailTimer?: ReturnType<typeof setInterval> };
/** Runs in the existing long-lived Google Cloud app; no page visit is needed. */
export function startPaymentEmailWorker() {
  if (state.paymentEmailTimer || !paymentEmailConfig(process.env)) return;
  let busy = false;
  const tick = async () => {
    if (busy) return;
    const config = paymentEmailConfig(process.env);
    if (!config) return;
    busy = true;
    try {
      const result = await deliverNextPaymentEmail(getDb(), config);
      if (result === "review") console.warn("A payment email needs review in payment_emails; check Resend before retrying.");
    } catch {
      console.error("Payment email worker failed; pending messages will be retried.");
    } finally { busy = false; }
  };
  state.paymentEmailTimer = setInterval(() => { void tick(); }, 5000);
  state.paymentEmailTimer.unref();
}
