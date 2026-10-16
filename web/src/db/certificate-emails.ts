import { and, asc, eq } from "drizzle-orm";

import { listAdminCertificates } from "./certificates";
import type { Database } from "./draws";
import { certificateEmails, users, type CertificateKind } from "./schema";
import { renderPlayerCertificate } from "@/lib/certificate-download";
import { certificateRequestBody } from "@/lib/certificate-email";
import { UnprintableTextError } from "@/lib/certificate-pdf";

export interface CertificateTarget {
  userId: string;
  entryId: string;
  kind: CertificateKind;
}

export type QueueResult = "queued" | "waiting" | "not-earned" | "unprintable";

export interface BulkQueueResult {
  queued: number;
  /** Certificates already emailed, waiting to send, or held for review. */
  skipped: number;
  /** Players whose names the certificate fonts cannot print. */
  unprintable: string[];
}

export type EmailState = "waiting" | "sent" | "review";

export interface CertificateEmailStatus {
  state: EmailState;
  /** When it was sent, or when it was queued while waiting or in review. */
  at: number;
  lastError: string | null;
}

export function certificateKey(target: CertificateTarget): string {
  return `${target.userId}/${target.entryId}/${target.kind}`;
}

function emailsFor(database: Database, target: CertificateTarget) {
  return database.select().from(certificateEmails).where(and(
    eq(certificateEmails.userId, target.userId),
    eq(certificateEmails.entryId, target.entryId),
    eq(certificateEmails.kind, target.kind),
  )).all();
}

/** Queues one email of the certificate, even if it was sent before. Refuses while one is still waiting. */
export async function queueCertificateEmail(
  database: Database,
  target: CertificateTarget,
  queuedBy: string,
  now: number,
): Promise<QueueResult> {
  if (emailsFor(database, target).some(row => row.acceptedAt === null && !row.needsReview)) return "waiting";
  const user = database.select({ email: users.email }).from(users).where(eq(users.id, target.userId)).get();
  if (!user) return "not-earned";
  try {
    const rendered = await renderPlayerCertificate(database, target.userId, target.entryId, target.kind);
    if (!rendered) return "not-earned";
    database.insert(certificateEmails).values({
      ...target,
      recipient: user.email,
      requestBody: certificateRequestBody({ recipient: user.email, ...rendered }),
      queuedBy: queuedBy.toLowerCase(),
      createdAt: now,
    }).run();
    return "queued";
  } catch (error) {
    if (error instanceof UnprintableTextError) return "unprintable";
    throw error;
  }
}

/** Queues every earned certificate that has never been emailed. */
export async function queueAllCertificateEmails(
  database: Database,
  tournamentId: string,
  queuedBy: string,
  now: number,
): Promise<BulkQueueResult> {
  const result: BulkQueueResult = { queued: 0, skipped: 0, unprintable: [] };
  for (const certificate of listAdminCertificates(database, tournamentId)) {
    if (emailsFor(database, certificate).length > 0) {
      result.skipped += 1;
      continue;
    }
    const outcome = await queueCertificateEmail(database, certificate, queuedBy, now);
    if (outcome === "queued") result.queued += 1;
    if (outcome === "unprintable" && !result.unprintable.includes(certificate.name)) result.unprintable.push(certificate.name);
  }
  return result;
}

/** The latest email of each certificate, keyed by certificateKey. */
export function listCertificateEmailStatuses(database: Database): Map<string, CertificateEmailStatus> {
  const rows = database.select().from(certificateEmails).orderBy(asc(certificateEmails.createdAt)).all();
  return new Map(rows.map(row => [
    certificateKey(row),
    {
      state: row.acceptedAt !== null ? "sent" : row.needsReview ? "review" : "waiting",
      at: row.acceptedAt ?? row.createdAt,
      lastError: row.lastError,
    },
  ]));
}
