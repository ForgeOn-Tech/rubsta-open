import { redirect } from "next/navigation";

import { auth } from "./auth";
import { isEntriesAdmin } from "@/lib/access";

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
 * Who may open the organiser entries view (/entries): any signed-in user when
 * DEMO_AUTH=true (prototype), otherwise only emails in ENTRIES_ADMIN_EMAILS.
 */
export function canViewEntries(email: string): boolean {
  if (process.env.DEMO_AUTH === "true") return true;
  return isEntriesAdmin(email, process.env.ENTRIES_ADMIN_EMAILS ?? "");
}

/**
 * Guard for /entries. Signed-out visitors go to /signin; signed-in players
 * without access go back to their own entry page.
 */
export async function requireEntriesAccess(): Promise<SessionUser> {
  const user = await requireUser();
  if (!canViewEntries(user.email)) redirect("/register");
  return user;
}
