import { CATEGORY_LABELS, type Category, type Entry, type PartnerStatus } from "@/db/schema";

export const PARTNER_PATH = "/partner";
export const PARTNER_DECISIONS = ["accept", "decline"] as const;
export type PartnerDecision = (typeof PARTNER_DECISIONS)[number];

export type Check = { ok: true } | { ok: false; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OK: Check = { ok: true };

function failed(error: string): Check {
  return { ok: false, error };
}

export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isEmailAddress(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

/** A singles entry is always ready; a doubles entry is ready once its partner accepts. */
export function partnerReady(partnerStatus: PartnerStatus | null): boolean {
  return partnerStatus === null || partnerStatus === "accepted";
}

/** The page a partner opens to answer an invitation. */
export function partnerInvitationPath(entryId: string): string {
  return `${PARTNER_PATH}/${entryId}`;
}

/**
 * Whether `responder` may answer the partner invitation on `entry`.
 * `playedCategories` are the events the responder already plays, on their own
 * entry or as an accepted partner.
 */
export function checkPartnerResponse(input: {
  entry: Pick<Entry, "userId" | "category" | "status" | "partnerEmail" | "partnerStatus">;
  responder: { userId: string; email: string; hasProfile: boolean };
  decision: PartnerDecision;
  playedCategories: readonly Category[];
}): Check {
  const { entry, responder, decision, playedCategories } = input;
  if (entry.partnerEmail === null || entry.partnerStatus === null) {
    return failed("This entry has no partner to confirm.");
  }
  if (normaliseEmail(responder.email) !== entry.partnerEmail) {
    return failed("This invitation is for a different email address.");
  }
  if (responder.userId === entry.userId) return failed("You cannot be the partner on your own entry.");
  if (entry.status === "cancelled") return failed("This entry was cancelled.");
  if (entry.partnerStatus !== "pending") return failed("This invitation has already been answered.");
  if (decision === "decline") return OK;
  if (!responder.hasProfile) return failed("Create your player profile before you accept.");
  if (playedCategories.includes(entry.category)) {
    return failed(`You already play ${CATEGORY_LABELS[entry.category]}, so you cannot accept.`);
  }
  return OK;
}

/** Whether the player who made a doubles entry may name a new partner. */
export function checkPartnerChange(input: {
  entry: Pick<Entry, "status" | "partnerStatus">;
  name: string;
  email: string;
  ownEmail: string;
  inPublishedDraw: boolean;
}): Check {
  const { entry, name, email, ownEmail, inPublishedDraw } = input;
  if (entry.partnerStatus === null) return failed("Singles entries have no partner.");
  if (entry.status === "cancelled") return failed("This entry was cancelled.");
  if (entry.partnerStatus === "accepted") {
    return failed("Your partner has accepted. Ask the organisers to change partner.");
  }
  if (inPublishedDraw) {
    return failed("This entry is in a published draw. Ask the organisers to change partner.");
  }
  if (name.trim() === "") return failed("Enter your partner's name.");
  if (!isEmailAddress(email)) return failed("Enter a valid partner email address.");
  if (normaliseEmail(email) === normaliseEmail(ownEmail)) {
    return failed("Enter your partner's email, not your own.");
  }
  return OK;
}
