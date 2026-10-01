/**
 * True when `email` is in a comma-separated allowlist such as ADMIN_EMAILS
 * or UMPIRE_EMAILS. Matching ignores case and surrounding spaces.
 */
export function isListedEmail(email: string, emailsCsv: string): boolean {
  const normalised = email.trim().toLowerCase();
  if (!normalised) return false;
  return emailsCsv
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .includes(normalised);
}
