/**
 * True when `email` is in the comma-separated ADMIN_EMAILS list.
 * Matching ignores case and surrounding spaces.
 */
export function isAdmin(email: string, adminEmailsCsv: string): boolean {
  const normalised = email.trim().toLowerCase();
  if (!normalised) return false;
  return adminEmailsCsv
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .includes(normalised);
}
