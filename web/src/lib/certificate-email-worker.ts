import { getDb } from "@/db/client";
import { certificateEmailConfig, deliverNextCertificateEmail } from "./certificate-email";

const TICK_MS = 5000;

const state = globalThis as typeof globalThis & { certificateEmailTimer?: ReturnType<typeof setInterval> };

/** Sends queued certificate emails from the long-running server, one every tick. */
export function startCertificateEmailWorker() {
  if (state.certificateEmailTimer || !certificateEmailConfig(process.env)) return;
  let busy = false;
  const tick = async () => {
    if (busy) return;
    const config = certificateEmailConfig(process.env);
    if (!config) return;
    busy = true;
    try {
      const result = await deliverNextCertificateEmail(getDb(), config, fetch, Date.now());
      if (result === "review") console.warn("A certificate email needs review in certificate_emails; check Resend before sending again.");
    } catch {
      console.error("Certificate email worker failed; waiting messages will be retried.");
    } finally {
      busy = false;
    }
  };
  state.certificateEmailTimer = setInterval(() => { void tick(); }, TICK_MS);
  state.certificateEmailTimer.unref();
}
