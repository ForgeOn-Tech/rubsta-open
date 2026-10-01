import Link from "next/link";

import { auth } from "@/auth/auth";
import { FAN_LIVE_PATH } from "@/lib/fan-chat";
import { PLAYER_DRAWS_PATH, PLAYER_ORDER_OF_PLAY_PATH, PUBLIC_RESULTS_PATH } from "@/lib/player-matches";

export const dynamic = "force-dynamic";

const NAV = [
  { href: PLAYER_DRAWS_PATH, label: "Draws" },
  { href: PUBLIC_RESULTS_PATH, label: "Results" },
  { href: PLAYER_ORDER_OF_PLAY_PATH, label: "Order of play" },
  { href: FAN_LIVE_PATH, label: "Live" },
];

/**
 * Draws, results and the order of play, in the landing page's club theme.
 * Anyone can read them; signing in adds the player's own markers.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const signedIn = Boolean(session?.user?.id);

  return (
    <div className="club flex min-h-screen flex-col">
      <header className="bg-club-forest text-club-mist">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-5">
          <Link href={signedIn ? "/home" : PLAYER_DRAWS_PATH} className="flex flex-col">
            <span className="font-serif text-[28px] leading-none tracking-[-0.4px]">Rubsta Open</span>
            <span className="mt-1.5 text-[9px] uppercase tracking-[1.5px]">Powered by ForgeLabs</span>
          </Link>
          <nav
            aria-label="Tournament"
            className="flex items-center gap-5 text-[11px] font-medium uppercase tracking-[1.5px]"
          >
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="hidden sm:inline">
                {item.label}
              </Link>
            ))}
            <Link href={signedIn ? "/home" : "/signin"}>{signedIn ? "Your account" : "Sign in"}</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">{children}</main>

      <footer className="border-t border-club-line">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-6">
          <span className="font-serif text-[22px]">Rubsta Open</span>
          <span className="text-[10px] font-medium uppercase tracking-[1.5px] text-club-muted">
            Powered by ForgeLabs
          </span>
        </div>
      </footer>
    </div>
  );
}
