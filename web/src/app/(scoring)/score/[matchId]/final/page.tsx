import { notFound } from "next/navigation";

import { finalScoreAction, scorerWalkoverAction, undoResultAction } from "./actions";
import { FinalScoreForm, UndoResultForm, WalkoverForm } from "./final-score-form";
import { requireScorer } from "@/auth/require";
import { ScoringLink as Link } from "@/components/scoring-link";
import { getDb } from "@/db/client";
import { getScoringMatch, isWalkover } from "@/db/matches";
import { CATEGORY_LABELS } from "@/lib/entries";
import { formatFor, formatSummary } from "@/lib/match-formats";
import { matchSummary, sideLabel } from "@/lib/scoring-display";

export const dynamic = "force-dynamic";

/** Where a scorer types in a final score from paper, records a walkover, or undoes either. */
export default async function FinalScorePage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  await requireScorer();
  const row = getScoringMatch(getDb(), matchId);
  if (!row) notFound();
  const { match } = row;
  const names = {
    top: sideLabel(row.top, match.topSlot).name,
    bottom: sideLabel(row.bottom, match.bottomSlot).name,
  };
  const format = match.format ?? formatFor(row.category, match.roundName);
  const ready = match.topSlot.kind === "entry" && match.bottomSlot.kind === "entry";
  const walkover = isWalkover(match);
  const summary = matchSummary(row);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <header className="border-b border-line bg-surface-1 px-5 pb-4 pt-[18px]">
        <Link href={`/score/${match.id}`} className="caps">
          <span aria-hidden="true">←</span> Back to the match
        </Link>
        <h1 className="mt-3 text-[20px] font-semibold tracking-[-0.01em]">
          M{match.matchNumber} · {CATEGORY_LABELS[row.category]} · {match.roundName}
        </h1>
        <p className="mt-1 text-[13px] text-muted">
          {names.top} v {names.bottom}
        </p>
        <p className="mono mt-1 text-[11px] text-muted">{formatSummary(format)}</p>
      </header>

      <main className="flex flex-col gap-5 px-5 py-5">
        {!ready ? (
          <p className="card p-4 text-[13px] text-muted" role="status">
            This match is waiting on an earlier result.
          </p>
        ) : match.status === "completed" ? (
          <section className="card flex flex-col gap-3 p-4" aria-label="Result">
            <p className="text-[14px]">
              {walkover ? "Walkover" : match.manualScore ? "Final score typed in" : "Scored point by point"}
              {summary === null ? "" : `: ${summary}`}
            </p>
            {walkover || match.manualScore ? (
              <>
                <p className="text-[13px] text-muted">
                  Wrong? Undo it, then enter the right result. This works until the winner&rsquo;s next match starts.
                </p>
                <UndoResultForm matchId={match.id} action={undoResultAction} />
              </>
            ) : (
              <p className="text-[13px] text-muted">An umpire scored this match, so its result cannot be changed here.</p>
            )}
          </section>
        ) : (
          <>
            {match.status === "in_progress" ? (
              <p className="card p-4 text-[13px] text-warn" role="status">
                An umpire started scoring this match. Saving a final score replaces the points scored so far.
              </p>
            ) : null}
            <FinalScoreForm matchId={match.id} names={names} format={format} action={finalScoreAction} />
            {match.status === "scheduled" ? (
              <WalkoverForm matchId={match.id} names={names} action={scorerWalkoverAction} />
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
