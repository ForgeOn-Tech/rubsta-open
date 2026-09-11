/** The emails in a comma-separated allowlist, lower case, without blanks or repeats. */
export function listedEmails(emailsCsv: string): string[] {
  const emails = emailsCsv
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value !== "");
  return [...new Set(emails)];
}

/**
 * True when `email` is in a comma-separated allowlist such as ADMIN_EMAILS
 * or UMPIRE_EMAILS. Matching ignores case and surrounding spaces.
 */
export function isListedEmail(email: string, emailsCsv: string): boolean {
  const normalised = email.trim().toLowerCase();
  if (!normalised) return false;
  return listedEmails(emailsCsv).includes(normalised);
}
