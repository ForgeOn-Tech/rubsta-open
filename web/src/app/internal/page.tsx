import { redirect } from "next/navigation";

import { canAccessAdmin, canScoreMatches, requireUser } from "@/auth/require";

export const dynamic = "force-dynamic";

/** Stable entry link; each destination retains its existing access checks. */
export default async function InternalPage() {
  const user = await requireUser();
  redirect(canAccessAdmin(user.email) ? "/admin" : canScoreMatches(user.email) ? "/score" : "/home");
}
