import type { UmpireLink } from "@/db/schema";

export const ADMIN_UMPIRES_PATH = "/admin/umpires";
export const UMPIRE_LINK_PATH = "/umpire";
export const MAX_UMPIRE_NAME_LENGTH = 60;
/** .invalid never resolves, so no email can ever reach these made-up addresses. */
const UMPIRE_EMAIL_DOMAIN = "rubstaopen.invalid";
const TOKEN_BYTES = 24;

/** The made-up email of the account a scoring link signs in as. */
export function umpireEmailFor(linkId: string): string {
  return `umpire-${linkId}@${UMPIRE_EMAIL_DOMAIN}`.toLowerCase();
}

/** True for the account of a scoring link, which has no player pages to go home to. */
export function isUmpireLinkEmail(email: string): boolean {
  const normalised = email.trim().toLowerCase();
  return normalised.startsWith("umpire-") && normalised.endsWith(`@${UMPIRE_EMAIL_DOMAIN}`);
}

/** A new link secret: 24 random bytes, URL-safe. */
export function newUmpireToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return Buffer.from(bytes).toString("base64url");
}

export function umpireLinkPath(token: string): string {
  return `${UMPIRE_LINK_PATH}/${token}`;
}

export type NameCheck = { ok: true; name: string } | { ok: false; error: string };

export function validateUmpireName(raw: string): NameCheck {
  const name = raw.trim();
  if (!name) return { ok: false, error: "Enter the umpire's name." };
  if (name.length > MAX_UMPIRE_NAME_LENGTH) {
    return { ok: false, error: `Keep the name to ${MAX_UMPIRE_NAME_LENGTH} characters.` };
  }
  return { ok: true, name };
}

/**
 * A link works until it is revoked, and until the day after the tournament ends.
 * `today` and `endsOn` are YYYY-MM-DD at the venue; with no end date set it never lapses.
 */
export function isLinkActive(link: Pick<UmpireLink, "revokedAt">, endsOn: string | null, today: string): boolean {
  return link.revokedAt === null && (endsOn === null || today <= endsOn);
}
