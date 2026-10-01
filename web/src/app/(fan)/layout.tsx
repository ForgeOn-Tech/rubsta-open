import Link from "next/link";

import { auth } from "@/auth/auth";
import { FAN_LEADERBOARD_PATH, FAN_LIVE_PATH } from "@/lib/fan-chat";
import {
  PLAYER_DRAWS_PATH,
  PLAYER_ORDER_OF_PLAY_PATH,
  PUBLIC_RESULTS_PATH,
} from "@/lib/player-matches";

export const dynamic = "force-dynamic";

/**
 * The Fan Zone is open to everyone: anyone can watch, and signing in is only
 * needed to chat, react or predict. Dark club colours, as the designed screen
 * has it.
 */
export default async function FanLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const signedIn = Boolean(session?.user?.id);

  return (
    <div className="club fan-shell flex min-h-screen flex-col bg-club-forest text-club-mist">
      <header className="border-b border-club-mist/20">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-5">
          <Link href={FAN_LIVE_PATH} className="flex flex-col">
            <span className="font-serif text-[28px] leading-none tracking-[-0.4px]">Rubsta Open</span>
            <span className="mt-1.5 text-[9px] uppercase tracking-[1.5px]">Fan zone</span>
          </Link>
          <nav
            aria-label="Fan zone"
            className="flex items-center gap-5 text-[11px] font-medium uppercase tracking-[1.5px]"
          >
            <Link href={FAN_LIVE_PATH}>Live</Link>
            <Link href={FAN_LEADERBOARD_PATH} className="hidden sm:inline">
              Leaderboard
            </Link>
            <Link href={PLAYER_DRAWS_PATH} className="hidden sm:inline">
              Draws
            </Link>
            <Link href={PUBLIC_RESULTS_PATH} className="hidden sm:inline">
              Results
            </Link>
            <Link href={PLAYER_ORDER_OF_PLAY_PATH} className="hidden sm:inline">
              Order of play
            </Link>
            {signedIn ? <Link href="/home">Your account</Link> : <Link href="/signin">Sign in</Link>}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">{children}</main>

      <footer className="border-t border-club-mist/20">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-6 text-[10px] font-medium uppercase tracking-[1.5px]">
          <span className="font-serif text-[22px] normal-case tracking-normal">Rubsta Open</span>
          <span>Powered by ForgeLabs</span>
        </div>
      </footer>
    </div>
  );
}
