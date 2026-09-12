import Link from "next/link";
import { notFound } from "next/navigation";

import { requireScorer } from "@/auth/require";
import { ScheduleCard } from "@/components/schedule-card";
import { getDb } from "@/db/client";
import { listCourts } from "@/db/courts";
import { listScoringMatches } from "@/db/matches";
import { getCurrentTournament } from "@/db/queries";
import { listNamesByEmail, listPublishedDays } from "@/db/schedule";
import {
  courtColumns,
  courtDetail,
  courtTitle,
  formatScheduleDay,
  itemName,
  venueClock,
} from "@/lib/schedule";
import { scoringGroupOf } from "@/lib/scoring-display";
import { isCalendarDate } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * The published order of play for umpires. The day is a path segment, not a
 * query: the service worker keeps pages by path, so each day stays available
 * without a connection.
 */
export default async function PublishedOrderOfPlayPage({
  params,
}: {
  params: Promise<{ day: string }>;
}) {
  const user = await requireScorer();
  const { day } = await params;
  if (!isCalendarDate(day)) notFound();

  const tournament = getCurrentTournament();
  const database = getDb();
  const publishedDays = tournament ? listPublishedDays(database, tournament.id) : [];
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
  const names = listNamesByEmail(database, [
    ...new Set(entries.flatMap((entry) => (entry.umpireEmail === null ? [] : [entry.umpireEmail]))),
  ]);
  const ownEmail = user.email.trim().toLowerCase();
  const matchNumberOf = (matchId: string | null): number | null =>
    matchId === null ? null : (rowsById.get(matchId)?.match.matchNumber ?? null);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <header className="border-b border-line bg-surface-1 px-5 pb-4 pt-[18px]">
        <div className="flex items-center gap-2.5 text-muted">
          <Link href="/score" aria-label="All matches" className="flex-none text-muted">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <span className="eyebrow truncate">{tournament?.name ?? "Tournament OS"} · Scoring</span>
        </div>
        <h1 className="mt-3 text-[20px] font-semibold tracking-[-0.01em]">Order of play</h1>
        {publishedDays.length > 1 ? (
          <nav aria-label="Days" className="mt-3 flex flex-wrap border border-line">
            {publishedDays.map((option) => {
              const current = option.day === day;
              return (
                <Link
                  key={option.day}
                  href={`/score/schedule/${option.day}`}
                  aria-current={current ? "page" : undefined}
                  className={`flex h-8 items-center border-line px-3 text-[12px] [&:not(:first-child)]:border-l ${
                    current ? "bg-surface-2 font-semibold" : ""
                  }`}
                  // Inline colour: the global `a` rule is unlayered and outranks utilities.
                  style={{ color: current ? "var(--color-ink)" : "var(--color-muted)" }}
                >
                  {formatScheduleDay(option.day)}
                </Link>
              );
            })}
          </nav>
        ) : null}
        <p className="mono mt-3 text-[11px] uppercase text-dim">
          {formatScheduleDay(day)}
          {published === null ? "" : ` · Published ${venueClock(published.publishedAt)}`}
        </p>
      </header>

      <main className="flex flex-col gap-6 px-5 py-5">
        {published === null ? (
          <p className="card p-4 text-[13px] text-muted" role="status">
            No order of play has been published for {formatScheduleDay(day)}.
          </p>
        ) : columns.length === 0 ? (
          <p className="card p-4 text-[13px] text-muted" role="status">
            Nothing is on court for {formatScheduleDay(day)}.
          </p>
        ) : (
          columns.map((column) => {
            const detail = courtDetail(column.court);
            return (
              <section key={column.number} aria-labelledby={`court-${column.number}-heading`}>
                <div className="border-b-2 border-ink pb-[9px]">
                  <h2 id={`court-${column.number}-heading`} className="text-[14px] font-semibold">
                    {courtTitle(column.number)}
                  </h2>
                  {detail === null ? null : (
                    <div className="mono mt-[3px] text-[10px] uppercase tracking-[0.06em] text-dim">
                      {detail}
                    </div>
                  )}
                </div>
                <ol className="mt-3 flex flex-col gap-3">
                  {column.items.map((entry, index) => {
                    const row = entry.matchId === null ? null : (rowsById.get(entry.matchId) ?? null);
                    const above = index === 0 ? null : column.items[index - 1];
                    const group = row === null ? null : scoringGroupOf(row);
                    const umpireName =
                      entry.umpireEmail === null
                        ? null
                        : entry.umpireEmail === ownEmail
                          ? "You"
                          : (names.get(entry.umpireEmail) ?? entry.umpireEmail);
                    return (
                      <li key={entry.id}>
                        <ScheduleCard
                          entry={entry}
                          row={row}
                          previousName={above === null ? null : itemName(above, matchNumberOf(above.matchId))}
                          umpireName={umpireName}
                        >
                          {row !== null && (group === "ready" || group === "in_progress") ? (
                            <Link
                              href={`/score/${row.match.id}`}
                              className="mt-2.5 block border-t border-line pt-2.5 text-[12px] font-semibold"
                            >
                              Score M{row.match.matchNumber}
                            </Link>
                          ) : null}
                        </ScheduleCard>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })
        )}
      </main>
    </div>
  );
}
