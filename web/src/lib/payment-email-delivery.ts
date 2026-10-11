import { and, asc, eq, isNull, lte } from "drizzle-orm";
import type { Database } from "@/db/draws";
import { paymentEmails } from "@/db/schema";

export interface EmailConfig { apiKey: string }
export function paymentEmailConfig(env: Record<string, string | undefined>): EmailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  return env.PAYMENT_EMAILS_ENABLED === "true" && apiKey ? { apiKey } : null;
}

// Resend retains idempotency keys for 24 hours. Hold uncertain sends before
// that window expires rather than risking a duplicate receipt.
const RETRY_WINDOW = 23 * 60 * 60 * 1000;
export async function deliverNextPaymentEmail(
  database: Database, config: EmailConfig, send: typeof fetch = fetch, now = Date.now(),
): Promise<"idle" | "accepted" | "retry" | "review"> {
  const message = database.transaction(tx => {
    const row = tx.select().from(paymentEmails).where(and(
      isNull(paymentEmails.acceptedAt), eq(paymentEmails.needsReview, false),
      lte(paymentEmails.nextAttemptAt, now),
    )).orderBy(asc(paymentEmails.createdAt)).get();
    if (!row) return null;
    if (row.firstAttemptAt !== null && now - row.firstAttemptAt >= RETRY_WINDOW) {
      tx.update(paymentEmails).set({ needsReview: true, lastError: "Delivery uncertain after retry window; check Resend before retrying." })
        .where(eq(paymentEmails.paymentId, row.paymentId)).run();
      return { review: true as const };
    }
    const requestBody = row.requestBody ?? JSON.stringify({
      from: "Rubsta Open <info@rubstaopen.com>", reply_to: "info@rubstaopen.com",
      to: [row.recipient], subject: row.subject, text: row.body,
      ...(row.html ? { html: row.html } : {}),
    });
    tx.update(paymentEmails).set({
      firstAttemptAt: row.firstAttemptAt ?? now, nextAttemptAt: now + 60_000,
      attempts: row.attempts + 1, requestBody,
    }).where(eq(paymentEmails.paymentId, row.paymentId)).run();
    return { ...row, requestBody, review: false as const };
  });
  if (!message) return "idle";
  if (message.review) return "review";
  let result: "retry" | "review" = "retry";
  let lastError = "Resend request timed out or could not be confirmed.";
  try {
    const response = await send("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json",
        "Idempotency-Key": `payment-confirmation/${message.paymentId}`,
      },
      body: message.requestBody, signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) {
      const data = await response.json() as { id?: unknown };
      if (typeof data.id !== "string" || !data.id) throw new Error("Missing provider reference");
      database.update(paymentEmails).set({ acceptedAt: now, providerId: data.id, lastError: null })
        .where(eq(paymentEmails.paymentId, message.paymentId)).run();
      return "accepted";
    }
    // Keep provider response bodies and secrets out of logs and saved errors.
    lastError = `Resend returned HTTP ${response.status}.`;
    if (response.status >= 400 && response.status < 500 && ![408, 409, 429].includes(response.status)) result = "review";
  } catch { /* Retry only the email. Payment remains confirmed. */ }
  database.update(paymentEmails).set({
    lastError, needsReview: result === "review",
    nextAttemptAt: now + Math.min(3600000, 60000 * 2 ** Math.min(message.attempts, 6)),
  }).where(eq(paymentEmails.paymentId, message.paymentId)).run();
  return result;
}
