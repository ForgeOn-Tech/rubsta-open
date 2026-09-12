import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/auth/require";
import { AdminPageHeader } from "@/components/admin-page-header";
import { MatchStatsTable } from "@/components/match-stats-table";
import { getDb } from "@/db/client";
import { getScoringMatch } from "@/db/matches";
import { getCurrentTournament } from "@/db/queries";
import { CATEGORY_LABELS } from "@/db/schema";
import { SIDES, deriveState, standardFormat } from "@/lib/match";
import { ADMIN_RESULTS_PATH, statRows, statsOfRecord } from "@/lib/match-stats";
import { snapshotOf } from "@/lib/score-sync";
import { formatElapsed, matchSummary, setGamesBySide, sideLabel } from "@/lib/scoring-display";

export const dynamic = "force-dynamic";

/** One match's score and statistics. */
export default async function AdminMatchResultPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  await requireAdmin();
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

  const stats = [
    match.status === "in_progress" ? "Live" : match.status === "completed" ? "Final" : "Not started",
    match.court === null ? "No court" : `Court ${match.court}`,
    ...(match.startedAt !== null && match.completedAt !== null
      ? [`${formatElapsed(match.completedAt - match.startedAt)} played`]
      : []),
    ...(summary === null ? [] : [summary]),
  ];

  return (
    <>
      <AdminPageHeader
        eyebrow={`${tournament?.name ?? "Tournament OS"} · Results`}
        title={`M${match.matchNumber} · ${CATEGORY_LABELS[row.category]} · ${match.roundName}`}
        stats={stats}
      />

      <div className="flex flex-col gap-5 p-6">
        <Link href={ADMIN_RESULTS_PATH} className="caps w-fit">
          All results
        </Link>

        <div className="card max-w-xl p-4">
          {SIDES.map((side) => (
            <div key={side} className="flex h-9 items-center gap-3 border-b border-line last:border-b-0">
              <span className="mono w-4 flex-none text-[11px] text-dim">{sides[side].seed ?? ""}</span>
              <span
                className={`min-w-0 flex-1 truncate text-[15px] ${
                  snapshot.winner === side ? "font-semibold text-ink" : "font-medium"
                }`}
              >
                {sides[side].name}
                {snapshot.winner === side ? <span className="sr-only"> (winner)</span> : null}
              </span>
              {games === null ? null : (
                <span className="mono flex-none text-[15px] font-semibold tracking-[0.04em]">{games[side]}</span>
              )}
            </div>
          ))}
        </div>

        <section aria-label="Statistics" className="card max-w-xl px-4 py-3">
          {record === null ? (
            <p className="text-[13px] text-muted" role="status">
              {match.status === "completed"
                ? "Walkover. No points were played."
                : "This match has not started."}
            </p>
          ) : (
            <MatchStatsTable
              rows={statRows(statsOfRecord(record))}
              names={{ top: sides.top.name, bottom: sides.bottom.name }}
            />
          )}
        </section>

        <div className="flex max-w-xl flex-col gap-1 text-[11px] text-dim">
          {retired ? <p>The statistics cover the points played before the retirement.</p> : null}
          {doubles ? <p>Doubles statistics are for each team, not each player.</p> : null}
          <p>
            The umpire records who won each point, not how, so aces, winners and unforced errors are not
            counted.
          </p>
        </div>
      </div>
    </>
  );
}
