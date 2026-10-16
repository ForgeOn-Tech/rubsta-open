"use server";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/auth/require";
import { getDb } from "@/db/client";
import { queueAllCertificateEmails, queueCertificateEmail } from "@/db/certificate-emails";
import { getCurrentTournament } from "@/db/queries";
import { isCertificateKind } from "@/lib/certificates";

const CERTIFICATES_PATH = "/admin/certificates";

export interface EmailActionState {
  error: string | null;
  message: string | null;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export async function emailAllCertificates(): Promise<EmailActionState> {
  const admin = await requireAdmin();
  const tournament = getCurrentTournament();
  if (!tournament) return { error: "No tournament has been set up.", message: null };
  const result = await queueAllCertificateEmails(getDb(), tournament.id, admin.email, Date.now());
  revalidatePath(CERTIFICATES_PATH);
  const parts = [
    `Queued ${plural(result.queued, "email")}.`,
    result.skipped > 0 ? `Skipped ${result.skipped} already emailed, waiting or held for review.` : null,
    result.unprintable.length > 0
      ? `Could not make certificates for ${result.unprintable.join(", ")}: the font cannot print their names.`
      : null,
  ];
  return { error: null, message: parts.filter(part => part !== null).join(" ") };
}

export async function emailCertificate(_previous: EmailActionState, form: FormData): Promise<EmailActionState> {
  const admin = await requireAdmin();
  const userId = String(form.get("userId") ?? "");
  const entryId = String(form.get("entryId") ?? "");
  const kind = String(form.get("kind") ?? "");
  if (!userId || !entryId || !isCertificateKind(kind)) return { error: "Choose a certificate.", message: null };
  const outcome = await queueCertificateEmail(getDb(), { userId, entryId, kind }, admin.email, Date.now());
  revalidatePath(CERTIFICATES_PATH);
  switch (outcome) {
    case "queued": return { error: null, message: "Queued." };
    case "waiting": return { error: "An email of this certificate is still waiting to send.", message: null };
    case "unprintable": return { error: "The certificate font cannot print this player's name.", message: null };
    case "not-earned": return { error: "This player has not earned this certificate.", message: null };
  }
}
