import Link from "next/link";

import { auth } from "@/auth/auth";
import { getDb } from "@/db/client";
import { listCourts } from "@/db/courts";
import { listScoringMatches, type ScoringMatchRow } from "@/db/matches";
import { listTeamEntryIds } from "@/db/partners";
import { getCurrentTournament } from "@/db/queries";
import { listPublishedDays } from "@/db/schedule";
import { CATEGORY_LABELS } from "@/db/schema";
import { PLAYER_ORDER_OF_PLAY_PATH, teamSide } from "@/lib/player-matches";
import {
  SCHEDULE_STATUS_LABELS,
  courtColumns,
  courtDetail,
  courtTitle,
  defaultScheduleDay,
  formatScheduleDay,
  itemName,
  timingLabel,
  venueClock,
  venueDay,
  type ScheduleEntry,
} from "@/lib/schedule";
import { matchSummary, sideLabel } from "@/lib/scoring-display";

export const dynamic = "force-dynamic";

/** A day's published order of play, marking a signed-in player's own matches. */
export default async function OrderOfPlayPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string | string[] }>;
}) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const tournament = getCurrentTournament();
  const database = getDb();
  const publishedDays = tournament ? listPublishedDays(database, tournament.id) : [];
  const days = publishedDays.map((option) => option.day);
  const requested = (await searchParams).day;
  const day =
    typeof requested === "string" && days.includes(requested)
      ? requested
      : defaultScheduleDay(days, venueDay(new Date().getTime()));
  const published = publishedDays.find((option) => option.day === day) ?? null;

  const rows = tournament ? listScoringMatches(database, tournament.id) : [];
  const rowsById = new Map(rows.map((row) => [row.match.id, row]));
  // A match deleted since publishing, when its draw went back to draft, drops out.
  const entries = (published?.items ?? []).filter(
    (entry) => entry.matchId === null || rowsById.has(entry.matchId),
  );
  const columns = courtColumns(tournament ? listCourts(database, tournament.id) : [], entries).filter(
    (column) => column.items.length > 0,
  );
  // Signed-out visitors have no entries, so no match is marked as theirs.
  const team = new Set(userId === null ? [] : listTeamEntryIds(database, userId));
  const matchNumberOf = (matchId: string | null): number | null =>
    matchId === null ? null : (rowsById.get(matchId)?.match.matchNumber ?? null);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[2px] text-club-muted">
          {tournament?.name ?? "Rubsta Open"} · Order of play
        </p>
        <h1 className="mt-2 font-serif text-[46px] font-normal leading-none tracking-[-1px]">Order of play</h1>
        {published === null ? null : (
          <p className="mt-3 text-[13px] text-club-muted">
            {formatScheduleDay(published.day)} · Published {venueClock(published.publishedAt)} · Times are at the
            venue
          </p>
        )}
      </div>

      {days.length > 1 ? (
        <nav aria-label="Days" className="flex flex-wrap gap-2">
          {days.map((option) => (
            <Link
              key={option}
              href={`${PLAYER_ORDER_OF_PLAY_PATH}?day=${option}`}
              aria-current={option === day ? "page" : undefined}
              className={`pill ${option === day ? "pill-primary" : "pill-outline"}`}
            >
              {formatScheduleDay(option)}
            </Link>
          ))}
        </nav>
      ) : null}

      {published === null ? (
        <p className="border-t border-club-line pt-5 text-[13px] text-club-muted" role="status">
          The order of play has not been published yet.
        </p>
      ) : columns.length === 0 ? (
        <p className="border-t border-club-line pt-5 text-[13px] text-club-muted" role="status">
          Nothing is on court that day.
        </p>
      ) : (
        <div className="grid gap-10 md:grid-cols-2">
          {columns.map((column) => {
            const detail = courtDetail(column.court);
            return (
              <section key={column.number} aria-labelledby={`court-${column.number}-heading`}>
                <h2 id={`court-${column.number}-heading`} className="font-serif text-[30px] font-normal leading-tight">
                  {courtTitle(column.number)}
                </h2>
                {detail === null ? null : (
                  <p className="text-[10px] font-medium uppercase tracking-[1.5px] text-club-muted">{detail}</p>
                )}
                <ol className="mt-4 border-t border-club-line">
                  {column.items.map((entry, index) => {
                    const above = index === 0 ? null : column.items[index - 1];
                    const timing = timingLabel(
                      entry,
                      above === null ? null : itemName(above, matchNumberOf(above.matchId)),
                    );
                    const row = entry.matchId === null ? null : (rowsById.get(entry.matchId) ?? null);
                    return (
                      <li key={entry.id} className="grid grid-cols-[104px_1fr] gap-3 border-b border-club-line py-3">
                        <span className="text-[12px] lining-nums text-club-muted">{timing}</span>
                        {row === null ? <SessionLine entry={entry} /> : <MatchLine row={row} team={team} />}
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SessionLine({ entry }: { entry: ScheduleEntry }) {
  return (
    <span className="min-w-0">
      <span className="block text-[14px] font-medium">{entry.title}</span>
      {entry.note === null ? null : <span className="block text-[12px] text-club-muted">{entry.note}</span>}
    </span>
  );
}

function MatchLine({ row, team }: { row: ScoringMatchRow; team: ReadonlySet<string> }) {
  const { match } = row;
  const mine = teamSide(row, team) !== null;
  const summary = matchSummary(row);
  return (
    <span className={`min-w-0 ${mine ? "border-l-2 border-club-deep pl-2.5" : ""}`}>
      <span className="block text-[10px] font-medium uppercase tracking-[1px] text-club-muted">
        M{match.matchNumber} · {CATEGORY_LABELS[row.category]} · {match.roundName}
        {mine ? <span className="ml-2 text-club-deep">Your match</span> : null}
      </span>
      <span className="block text-[14px] font-medium">
        {sideLabel(row.top, match.topSlot).name} v {sideLabel(row.bottom, match.bottomSlot).name}
      </span>
      <span className="block text-[12px] text-club-muted">
        {SCHEDULE_STATUS_LABELS[match.status]}
        {summary === null ? "" : ` · ${summary}`}
      </span>
    </span>
  );
}
