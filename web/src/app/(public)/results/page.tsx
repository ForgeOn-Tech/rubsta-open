import Link from "next/link";

import { AutoRefresh } from "@/components/auto-refresh";
import { getDb } from "@/db/client";
import { listScoringMatches, type ScoringMatchRow } from "@/db/matches";
import { getCurrentTournament } from "@/db/queries";
import { CATEGORIES, CATEGORY_LABELS } from "@/db/schema";
import { PUBLIC_RESULTS_PATH } from "@/lib/player-matches";
import { venueClock } from "@/lib/schedule";
import { matchSummary, scoringGroupOf, shortRoundName, sideLabel } from "@/lib/scoring-display";

export const dynamic = "force-dynamic";

/** How often the results list looks for a new score. */
const REFRESH_SECONDS = 30;

/** Every match that has started, by event. Open to everyone. */
export default async function ResultsPage() {
  const tournament = getCurrentTournament();
  const rows = tournament
    ? listScoringMatches(getDb(), tournament.id).filter((row) => {
        const group = scoringGroupOf(row);
        return group === "in_progress" || group === "completed";
      })
    : [];
  const events = CATEGORIES.map((category) => ({
    category,
    rows: rows.filter((row) => row.category === category),
  })).filter((event) => event.rows.length > 0);

  return (
    <div className="flex flex-col gap-8">
      <AutoRefresh seconds={REFRESH_SECONDS} />
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[2px] text-club-muted">
          {tournament?.name ?? "Rubsta Open"} · Results
        </p>
        <h1 className="mt-2 font-serif text-[46px] font-normal leading-none tracking-[-1px]">Results</h1>
      </div>

      {events.length === 0 ? (
        <p className="border-t border-club-line pt-5 text-[13px] text-club-muted" role="status">
          No match has started. Scores appear here as umpires score them.
        </p>
      ) : (
        events.map((event) => (
          <section key={event.category} aria-labelledby={`results-${event.category}`}>
            <h2
              id={`results-${event.category}`}
              className="font-serif text-[30px] font-normal leading-tight"
            >
              {CATEGORY_LABELS[event.category]}
            </h2>
            <ul className="mt-3 border-t border-club-line">
              {event.rows.map((row) => (
                <li key={row.match.id} className="border-b border-club-line">
                  <ResultLine row={row} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function ResultLine({ row }: { row: ScoringMatchRow }) {
  const { match } = row;
  const winnerEntryId = match.winnerEntryId;
  const sides = [
    { key: "top", slot: match.topSlot, label: sideLabel(row.top, match.topSlot) },
    { key: "bottom", slot: match.bottomSlot, label: sideLabel(row.bottom, match.bottomSlot) },
  ];
  const live = match.status === "in_progress";

  return (
    <Link
      href={`${PUBLIC_RESULTS_PATH}/${match.id}`}
      className="flex flex-wrap items-center justify-between gap-3 py-3.5 hover:bg-club-paper sm:px-2"
    >
      <span className="min-w-0">
        <span className="block text-[10px] font-medium uppercase tracking-[1.5px] text-club-muted">
          M{match.matchNumber} · {shortRoundName(match.roundName)}
          {match.startedAt === null ? "" : ` · ${venueClock(match.startedAt)}`}
        </span>
        {sides.map((side) => (
          <span
            key={side.key}
            className={`block text-[15px] ${
              side.slot.kind === "entry" && side.slot.entryId === winnerEntryId ? "font-semibold" : ""
            }`}
          >
            {side.label.name}
          </span>
        ))}
      </span>
      <span className="flex shrink-0 items-center gap-3">
        <span className="text-[14px] font-medium lining-nums">{matchSummary(row) ?? ""}</span>
        {live ? (
          <span className="bg-club-deep px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[1.5px] text-club-cream">
            Live
          </span>
        ) : (
          <span className="border border-club-line px-2 py-0.5 text-[10px] uppercase tracking-[1.5px] text-club-muted">
            Final
          </span>
        )}
      </span>
    </Link>
  );
}
