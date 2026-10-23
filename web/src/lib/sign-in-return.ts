/** Where sign-in goes when no page asked to come back. */
export const DEFAULT_AFTER_SIGN_IN = "/home";

/**
 * The page to return to after sign-in, from the sign-in page's `next` value. Only a path on
 * this site counts, so a crafted link cannot send someone to another site.
 */
export function afterSignInPath(next: string): string {
  const path = next.trim();
  const onThisSite = path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\");
  return onThisSite ? path : DEFAULT_AFTER_SIGN_IN;
}

/** The sign-in page, coming back to `path` afterwards, e.g. "/signin?next=%2Flive%2F3". */
export function signInPathFor(path: string): string {
  return `/signin?next=${encodeURIComponent(path)}`;
}
