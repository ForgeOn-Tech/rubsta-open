import { PlayerHeader } from "@/components/player-header";
import { auth } from "@/auth/auth";

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
      <PlayerHeader signedIn={signedIn} />

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
