import Link from "next/link";

import { requireAdmin } from "@/auth/require";
import { AdminNotice } from "@/components/admin-notice";
import { AdminPageHeader } from "@/components/admin-page-header";
import { getDb } from "@/db/client";
import { listScoringMatches, type ScoringMatchRow } from "@/db/matches";
import { getCurrentTournament } from "@/db/queries";
import { CATEGORIES, CATEGORY_LABELS } from "@/db/schema";
import { countLabel } from "@/lib/format";
import { ADMIN_RESULTS_PATH } from "@/lib/match-stats";
import { venueClock } from "@/lib/schedule";
import { formatElapsed, matchSummary, scoringGroupOf, sideLabel } from "@/lib/scoring-display";

export const dynamic = "force-dynamic";

const COLUMNS = ["Match", "Players", "Score", "Status", "Time"] as const;

function matchTime(row: ScoringMatchRow): string {
  const { startedAt, completedAt } = row.match;
  if (startedAt === null) return "";
  return completedAt === null ? `From ${venueClock(startedAt)}` : formatElapsed(completedAt - startedAt);
}

/** Every match that has started, by event, each opening its statistics. */
export default async function AdminResultsPage() {
  await requireAdmin();
  const tournament = getCurrentTournament();
  if (!tournament) return <AdminNotice message="No tournament has been set up." />;

  const rows = listScoringMatches(getDb(), tournament.id).filter((row) => {
    const group = scoringGroupOf(row);
    return group === "in_progress" || group === "completed";
  });
  const events = CATEGORIES.map((category) => ({
    category,
    rows: rows.filter((row) => row.category === category),
  })).filter((event) => event.rows.length > 0);
  const live = rows.filter((row) => row.match.status === "in_progress").length;

  return (
    <>
      <AdminPageHeader
        eyebrow={`${tournament.name} · Results`}
        title="Results"
        stats={[`${live} live`, countLabel(rows.length - live, "result", "results")]}
      />

      <div className="flex flex-col gap-6 p-6">
        {events.length === 0 ? (
          <p className="card p-4 text-[13px] text-muted" role="status">
            No match has started. Scores appear here once umpires start scoring.
          </p>
        ) : (
          events.map((event) => (
            <section key={event.category} aria-labelledby={`results-${event.category}`}>
              <h2 id={`results-${event.category}`} className="thead">
                {CATEGORY_LABELS[event.category]}
              </h2>
              <div className="card mt-2 overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-line">
                      {COLUMNS.map((column) => (
                        <th key={column} scope="col" className="thead px-4 py-3 font-normal">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {event.rows.map((row) => (
                      <ResultRow key={row.match.id} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}
      </div>
    </>
  );
}

function ResultRow({ row }: { row: ScoringMatchRow }) {
  const { match } = row;
  const winnerEntryId = match.winnerEntryId;
  const sides = [
    { side: "top", slot: match.topSlot, label: sideLabel(row.top, match.topSlot) },
    { side: "bottom", slot: match.bottomSlot, label: sideLabel(row.bottom, match.bottomSlot) },
  ];

  return (
    <tr className="border-b border-line last:border-b-0">
      <th scope="row" className="px-4 py-3 text-left font-medium">
        <Link href={`${ADMIN_RESULTS_PATH}/${match.id}`}>
          M{match.matchNumber} · {match.roundName}
        </Link>
      </th>
      <td className="px-4 py-3">
        {sides.map(({ side, slot, label }) => (
          <div
            key={side}
            className={
              slot.kind === "entry" && slot.entryId === winnerEntryId ? "font-semibold" : "text-ink"
            }
          >
            {label.name}
          </div>
        ))}
      </td>
      <td className="mono px-4 py-3">{matchSummary(row) ?? ""}</td>
      <td className="px-4 py-3">
        {match.status === "in_progress" ? (
          <span className="mono bg-accent px-[7px] py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent-fg">
            Live
          </span>
        ) : (
          <span className="mono border border-line px-[7px] py-0.5 text-[10px] uppercase tracking-[0.08em] text-dim">
            Final
          </span>
        )}
      </td>
      <td className="mono px-4 py-3 text-muted">{matchTime(row)}</td>
    </tr>
  );
}
