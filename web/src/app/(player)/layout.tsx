import { PlayerHeader } from "@/components/player-header";
import Link from "next/link";

import { canAccessAdmin, canScoreMatches, requireUser } from "@/auth/require";

export const dynamic = "force-dynamic";

/** Player-facing chrome in the landing page's club theme (see `.club` in globals.css). */
export default async function PlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const admin = canAccessAdmin(user.email);
  const scorer = canScoreMatches(user.email);
  const demoMode = process.env.DEMO_AUTH === "true";

  return (
    <div className="club flex flex-col">
      <PlayerHeader signedIn={true} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">{children}</main>

      <footer className="border-t border-club-line">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-6">
          <span className="font-serif text-[22px]">Rubsta Open</span>
          <div className="flex flex-wrap items-center gap-4 text-[10px] font-medium uppercase tracking-[1.5px] text-club-muted">
            <span>Powered by ForgeLabs</span>
            {admin ? <Link href="/admin">Admin</Link> : null}
            {scorer ? <Link href="/score">Scoring</Link> : null}
            {demoMode ? (
              <span className="badge badge-submitted">Demo mode</span>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  );
}
