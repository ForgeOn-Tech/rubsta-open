import Link from "next/link";
import { notFound } from "next/navigation";

import { AutoRefresh } from "@/components/auto-refresh";
import { MatchStatsTable } from "@/components/match-stats-table";
import { getDb } from "@/db/client";
import { getScoringMatch } from "@/db/matches";
import { getCurrentTournament } from "@/db/queries";
import { CATEGORY_LABELS } from "@/db/schema";
import { SIDES, deriveState, standardFormat } from "@/lib/match";
import { statRows, statsOfRecord } from "@/lib/match-stats";
import { PUBLIC_RESULTS_PATH } from "@/lib/player-matches";
import { snapshotOf } from "@/lib/score-sync";
import { formatElapsed, matchSummary, setGamesBySide, sideLabel } from "@/lib/scoring-display";

export const dynamic = "force-dynamic";

const REFRESH_SECONDS = 20;

/** One match's score and statistics. Open to everyone. */
export default async function ResultPage({ params }: { params: Promise<{ matchId: string }> }) {
  const row = getScoringMatch(getDb(), (await params).matchId);
  if (!row) notFound();

  const { match } = row;
  const tournament = getCurrentTournament();
  const sides = { top: sideLabel(row.top, match.topSlot), bottom: sideLabel(row.bottom, match.bottomSlot) };
  const snapshot = snapshotOf(match);
  const record = snapshot.record;
  const games = setGamesBySide(row);
  const summary = matchSummary(row);
  // A completed match whose points never finished it ended by retirement.
  const retired =
    record !== null &&
    match.status === "completed" &&
    deriveState(record.events, standardFormat(record.decidingSet), record.firstServer).status !== "completed";
  const doubles = [row.top, row.bottom].some((info) => info !== null && info.partnerName !== null);
  const facts = [
    match.status === "in_progress" ? "Live" : match.status === "completed" ? "Final" : "Not started",
    ...(match.court === null ? [] : [`Court ${match.court}`]),
    ...(match.startedAt !== null && match.completedAt !== null
      ? [`${formatElapsed(match.completedAt - match.startedAt)} played`]
      : []),
    ...(summary === null ? [] : [summary]),
  ];

  return (
    <div className="flex flex-col gap-6">
      {match.status === "in_progress" ? <AutoRefresh seconds={REFRESH_SECONDS} /> : null}
      <div>
        <Link
          href={PUBLIC_RESULTS_PATH}
          className="text-[10px] font-medium uppercase tracking-[2px] text-club-muted"
        >
          <span aria-hidden="true">←</span> All results
        </Link>
        <h1 className="mt-3 font-serif text-[40px] font-normal leading-none tracking-[-1px]">
          {CATEGORY_LABELS[row.category]} · {match.roundName}
        </h1>
        <p className="mt-2 text-[10px] font-medium uppercase tracking-[1.5px] text-club-muted">
          {tournament?.name ?? "Rubsta Open"} · M{match.matchNumber} · {facts.join(" · ")}
        </p>
      </div>

      <div className="border-t border-club-line">
        {SIDES.map((side) => (
          <div key={side} className="flex items-center gap-3 border-b border-club-line py-3">
            <span className="w-4 flex-none text-[11px] text-club-muted lining-nums">
              {sides[side].seed ?? ""}
            </span>
            <span
              className={`min-w-0 flex-1 truncate text-[17px] ${
                snapshot.winner === side ? "font-semibold" : ""
              }`}
            >
              {sides[side].name}
              {snapshot.winner === side ? <span className="sr-only"> (winner)</span> : null}
            </span>
            {games === null ? null : (
              <span className="flex-none text-[17px] font-semibold lining-nums">{games[side]}</span>
            )}
          </div>
        ))}
      </div>

      <section aria-label="Statistics" className="border border-club-line px-4 py-3">
        {record === null ? (
          <p className="text-[13px] text-club-muted" role="status">
            {match.status === "completed" ? "Walkover. No points were played." : "This match has not started."}
          </p>
        ) : (
          <MatchStatsTable
            rows={statRows(statsOfRecord(record))}
            names={{ top: sides.top.name, bottom: sides.bottom.name }}
          />
        )}
      </section>

      <div className="flex flex-col gap-1 text-[11px] text-club-muted">
        {retired ? <p>The statistics cover the points played before the retirement.</p> : null}
        {doubles ? <p>Doubles statistics are for each team, not each player.</p> : null}
        <p>
          The umpire records who won each point, not how, so aces, winners and unforced errors are not
          counted.
        </p>
      </div>
    </div>
  );
}
