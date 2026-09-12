import { redirect } from "next/navigation";

import { auth } from "./auth";
import { isListedEmail, listedEmails } from "@/lib/access";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

async function sessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
  };
}

/** Server-side guard: pages requiring a session redirect to /signin. */
export async function requireUser(): Promise<SessionUser> {
  const user = await sessionUser();
  if (!user) redirect("/signin");
  return user;
}

/**
 * Admin access comes only from ADMIN_EMAILS. Demo mode grants nothing extra;
 * list demo@rubstaopen.local to use /admin locally.
 */
export function canAccessAdmin(email: string): boolean {
  return isListedEmail(email, process.env.ADMIN_EMAILS ?? "");
}

/** Guard for /admin. Signed-out visitors go to /signin; players without access go home. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!canAccessAdmin(user.email)) redirect("/home");
  return user;
}

/** Umpires in UMPIRE_EMAILS can score matches, and so can every admin. */
export function canScoreMatches(email: string): boolean {
  return canAccessAdmin(email) || isListedEmail(email, process.env.UMPIRE_EMAILS ?? "");
}

/** Everyone who can score, umpires first, for assigning matches on the order of play. */
export function listScorerEmails(): string[] {
  return [
    ...new Set([
      ...listedEmails(process.env.UMPIRE_EMAILS ?? ""),
      ...listedEmails(process.env.ADMIN_EMAILS ?? ""),
    ]),
  ];
}

/** Guard for /score. Signed-out visitors go to /signin; others without access go home. */
export async function requireScorer(): Promise<SessionUser> {
  const user = await requireUser();
  if (!canScoreMatches(user.email)) redirect("/home");
  return user;
}
