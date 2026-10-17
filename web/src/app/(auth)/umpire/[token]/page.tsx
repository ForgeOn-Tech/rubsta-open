import { startScoring } from "./actions";
import { ClearOfflinePages } from "../../signin/clear-offline-pages";
import { getDb } from "@/db/client";
import { getCurrentTournament } from "@/db/queries";
import { activeLinkByToken } from "@/db/umpire-links";
import { venueDay } from "@/lib/schedule";

export const dynamic = "force-dynamic";

/**
 * Where an umpire's personal link lands. Opening it changes nothing, so a chat app that
 * previews the link cannot sign anyone in; the button does.
 */
export default async function UmpireLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = activeLinkByToken(getDb(), token, venueDay(new Date().getTime()));
  const tournament = getCurrentTournament();

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12" style={{ background: "var(--color-surface-0)" }}>
      <ClearOfflinePages />
      <div className="card w-full max-w-sm p-8">
        <div className="eyebrow">{tournament?.name ?? "Rubsta Open"} · Umpires</div>
        {link === null ? (
          <>
            <h1 className="mt-3 text-[20px] font-semibold tracking-[-0.01em]">This scoring link no longer works</h1>
            <p className="mt-2 text-[13px] text-muted" role="alert">
              It was removed, or the tournament is over. Ask the organiser for a new link.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-3 text-[20px] font-semibold tracking-[-0.01em]">Hi {link.name}</h1>
            <p className="mt-2 text-[13px] text-muted">
              This link lets you score matches on this phone. Keep it to yourself: anyone with it can score.
            </p>
            <form action={startScoring} className="mt-8">
              <input type="hidden" name="token" value={token} />
              <button type="submit" className="btn btn-primary w-full">
                Start scoring
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
