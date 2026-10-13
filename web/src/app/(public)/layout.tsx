import { PlayerHeader } from "@/components/player-header";
import { auth } from "@/auth/auth";

export const dynamic = "force-dynamic";

/**
 * Draws, results and the order of play, in the landing page's club theme.
 * Anyone can read them; signing in adds the player's own markers.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const signedIn = Boolean(session?.user?.id);

  return (
    <div className="club flex min-h-screen flex-col">
      <PlayerHeader signedIn={signedIn} />

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
