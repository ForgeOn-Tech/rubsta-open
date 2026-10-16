import { and, asc, eq, isNull, lte } from "drizzle-orm";

import type { Database } from "@/db/draws";
import { certificateEmails } from "@/db/schema";
import { escapeEmailText } from "@/lib/email-layout";

const SENDER = "Rubsta Open <info@rubstaopen.com>";
const REPLY_TO = "info@rubstaopen.com";
const HOME = "https://www.rubstaopen.com/home";
const RESEND_URL = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 10_000;
const FIRST_RETRY_MS = 60_000;
const MAX_RETRY_MS = 60 * 60 * 1000;
const MAX_BACKOFF_STEPS = 6;
// Resend keeps idempotency keys for 24 hours. Hold uncertain sends before
// that window ends rather than risk a second copy.
const RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;
const RETRYABLE_CLIENT_STATUSES = [408, 409, 429];

export interface CertificateEmailConfig {
  apiKey: string;
}

/** Off unless CERTIFICATE_EMAILS_ENABLED is "true" and a Resend key is set. Payment emails have their own switch. */
export function certificateEmailConfig(env: Record<string, string | undefined>): CertificateEmailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  return env.CERTIFICATE_EMAILS_ENABLED === "true" && apiKey ? { apiKey } : null;
}

export interface CertificateEmailDetails {
  recipient: string;
  playerName: string;
  tournamentName: string;
  /** e.g. "Open singles · Winner's certificate". */
  label: string;
  fileName: string;
  pdf: Uint8Array;
}

function emailHtml(subject: string, details: CertificateEmailDetails): string {
  const paragraph = (text: string) =>
    `<p style="margin:0 0 20px;font-size:16px;line-height:26px;color:#33483b;">${escapeEmailText(text).replace(/\n/g, "<br>")}</p>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeEmailText(subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f1e8;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f1e8"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;" bgcolor="#ffffff">
<tr><td bgcolor="#203d2e" style="padding:28px 24px;"><p style="margin:0;font-family:Georgia,serif;font-size:30px;line-height:38px;color:#ffffff;">Rubsta Open</p><p style="margin:8px 0 0;font-size:10px;line-height:16px;letter-spacing:2px;text-transform:uppercase;color:#dce5d8;">Your certificate</p></td></tr>
<tr><td style="padding:32px 24px 12px;word-break:break-word;">
<h1 style="margin:0 0 28px;font-family:Georgia,serif;font-size:32px;line-height:40px;font-weight:normal;color:#203d2e;">Thank you for playing.</h1>
${paragraph(`Hi ${details.playerName},`)}
${paragraph(`Your ${details.label} from ${details.tournamentName} is attached to this email as a PDF.`)}
${paragraph("You can also download it any time from your player account.")}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px;"><tr><td bgcolor="#203d2e" style="border-radius:6px;border:1px solid #203d2e;text-align:center;"><a href="${HOME}" style="display:inline-block;padding:14px 22px;font-size:15px;line-height:22px;font-weight:bold;text-decoration:none;color:#ffffff;">Open player account</a></td></tr></table>
${paragraph("See you on court,\nTeam Rubsta Open")}
</td></tr>
<tr><td style="padding:20px 24px;border-top:1px solid #e6e9e1;font-size:12px;line-height:20px;color:#667369;">Rubsta Open · Powered by ForgeLabs<br><a href="mailto:${REPLY_TO}" style="color:#526456;text-decoration:underline;">${REPLY_TO}</a></td></tr>
</table></td></tr></table></body></html>`;
}

/** The full Resend request, PDF attached. Saved once and sent unchanged on every retry. */
export function certificateRequestBody(details: CertificateEmailDetails): string {
  const subject = `Your ${details.tournamentName} certificate: ${details.label}`;
  const text = [
    `Hi ${details.playerName},`,
    "",
    `Your ${details.label} from ${details.tournamentName} is attached to this email as a PDF.`,
    "",
    `You can also download it any time from your player account: ${HOME}`,
    "",
    "See you on court,",
    "Team Rubsta Open",
  ].join("\n");
  return JSON.stringify({
    from: SENDER,
    reply_to: REPLY_TO,
    to: [details.recipient],
    subject,
    text,
    html: emailHtml(subject, details),
    attachments: [{ filename: details.fileName, content: Buffer.from(details.pdf).toString("base64") }],
  });
}

export type DeliveryResult = "idle" | "accepted" | "retry" | "review";

/** Sends the oldest waiting certificate email. One row per call. */
export async function deliverNextCertificateEmail(
  database: Database,
  config: CertificateEmailConfig,
  send: typeof fetch,
  now: number,
): Promise<DeliveryResult> {
  const message = database.transaction((tx) => {
    const row = tx.select().from(certificateEmails).where(and(
      isNull(certificateEmails.acceptedAt),
      eq(certificateEmails.needsReview, false),
      lte(certificateEmails.nextAttemptAt, now),
    )).orderBy(asc(certificateEmails.createdAt)).get();
    if (!row) return null;
    if (row.firstAttemptAt !== null && now - row.firstAttemptAt >= RETRY_WINDOW_MS) {
      tx.update(certificateEmails)
        .set({ needsReview: true, lastError: "Delivery uncertain after the retry window; check Resend before sending again." })
        .where(eq(certificateEmails.id, row.id)).run();
      return "expired" as const;
    }
    tx.update(certificateEmails).set({
      firstAttemptAt: row.firstAttemptAt ?? now,
      nextAttemptAt: now + FIRST_RETRY_MS,
      attempts: row.attempts + 1,
    }).where(eq(certificateEmails.id, row.id)).run();
    return row;
  });
  if (!message) return "idle";
  if (message === "expired") return "review";

  let result: "retry" | "review" = "retry";
  let lastError = "Resend request timed out or could not be confirmed.";
  try {
    const response = await send(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `certificate/${message.id}`,
      },
      body: message.requestBody,
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (response.ok) {
      const data = await response.json() as { id?: unknown };
      if (typeof data.id !== "string" || !data.id) throw new Error("Resend accepted the email without an id.");
      database.update(certificateEmails).set({ acceptedAt: now, providerId: data.id, lastError: null })
        .where(eq(certificateEmails.id, message.id)).run();
      return "accepted";
    }
    // Keep response bodies, which may echo the request, out of the saved error.
    lastError = `Resend returned HTTP ${response.status}.`;
    if (response.status >= 400 && response.status < 500 && !RETRYABLE_CLIENT_STATUSES.includes(response.status)) {
      result = "review";
    }
  } catch {
    // A network failure or timeout: retry with the same key and body.
  }
  database.update(certificateEmails).set({
    lastError,
    needsReview: result === "review",
    nextAttemptAt: now + Math.min(MAX_RETRY_MS, FIRST_RETRY_MS * 2 ** Math.min(message.attempts, MAX_BACKOFF_STEPS)),
  }).where(eq(certificateEmails.id, message.id)).run();
  return result;
}
