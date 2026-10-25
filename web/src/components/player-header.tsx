import Link from "next/link";

import { signOutAction } from "@/auth/actions";
import { InstallAppButton } from "./install-app-button";
import { PlayerNav } from "./player-nav";

/** Shared across account, registration, public results and Fan Zone pages. */
export function PlayerHeader({ signedIn }: { signedIn: boolean }) {
  return <header className="bg-club-forest text-club-mist">
    <div className="mx-auto w-full max-w-5xl px-5">
      <div className="flex items-center justify-between gap-4 py-5">
        <Link href={signedIn ? "/home" : "/draws"} className="flex flex-col" style={{ color: "inherit" }}>
          <span className="font-serif text-[28px] leading-none tracking-[-0.4px]">Rubsta Open</span>
          <span className="mt-1.5 text-[9px] uppercase tracking-[1.5px]">Powered by ForgeLabs</span>
        </Link>
        <div className="flex items-center gap-5">
          <InstallAppButton />
          {signedIn ? <form action={signOutAction}>
            <button type="submit" className="cursor-pointer whitespace-nowrap text-[11px] font-medium uppercase tracking-[1px]">Sign out</button>
          </form> : <Link href="/signin" style={{ color: "inherit" }}>Sign in</Link>}
        </div>
      </div>
      <PlayerNav signedIn={signedIn} />
    </div>
  </header>;
}
