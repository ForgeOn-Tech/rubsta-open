import Link from "next/link";

import { signOutAction } from "@/auth/actions";
import { canAccessAdmin, requireUser } from "@/auth/require";

export const dynamic = "force-dynamic";

/** Player-facing chrome in the landing page's club theme (see `.club` in globals.css). */
export default async function PlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const admin = canAccessAdmin(user.email);
  const demoMode = process.env.DEMO_AUTH === "true";

  return (
    <div className="club flex flex-col">
      <header className="bg-club-forest text-club-mist">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-5">
          <Link href="/home" className="flex flex-col">
            <span className="font-serif text-[28px] leading-none tracking-[-0.4px]">
              Rubsta Open
            </span>
            <span className="mt-1.5 text-[9px] uppercase tracking-[1.5px]">
              Powered by ForgeLabs
            </span>
          </Link>
          <nav
            aria-label="Player"
            className="flex items-center gap-5 text-[11px] font-medium uppercase tracking-[1.5px]"
          >
            <Link href="/register" className="hidden sm:inline">
              Enter an event
            </Link>
            <Link href="/profile" className="hidden sm:inline">
              Profile
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="cursor-pointer font-medium uppercase tracking-[1.5px]"
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">{children}</main>

      <footer className="border-t border-club-line">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-6">
          <span className="font-serif text-[22px]">Rubsta Open</span>
          <div className="flex flex-wrap items-center gap-4 text-[10px] font-medium uppercase tracking-[1.5px] text-club-muted">
            <span>Powered by ForgeLabs</span>
            {admin ? <Link href="/admin">Admin</Link> : null}
            {demoMode ? (
              <span className="badge badge-submitted">Demo mode</span>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  );
}
