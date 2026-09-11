import Link from "next/link";

import { PrintButton } from "./print-button";
import { requireAdmin } from "@/auth/require";
import { getDb } from "@/db/client";
import { listCourts } from "@/db/courts";
import { listScoringMatches } from "@/db/matches";
import { getCurrentTournament } from "@/db/queries";
import { getPublishedDay, listNamesByEmail, listScheduleDaysInUse, listScheduleItems } from "@/db/schedule";
import { CATEGORY_LABELS } from "@/db/schema";
import {
  ADMIN_ORDER_OF_PLAY_PATH,
  courtColumns,
  courtDetail,
  courtTitle,
  defaultScheduleDay,
  formatScheduleDay,
  hasUnpublishedChanges,
  itemName,
  scheduleDayChoices,
  scheduleEntryOf,
  timingLabel,
  tournamentDays,
  venueClock,
  venueDay,
} from "@/lib/schedule";
import { sideLabel } from "@/lib/scoring-display";

export const dynamic = "force-dynamic";

const CELL = "border-b border-line px-2 py-1.5 text-left align-top";

/**
 * A day's published order of play as a sheet to print and pin up. It sits in
 * its own route group so the admin sidebar stays off the page.
 */
export default async function OrderOfPlayPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string | string[] }>;
}) {
  await requireAdmin();
  const tournament = getCurrentTournament();
  if (!tournament) {
    return <p className="p-6 text-[13px] text-muted">No tournament has been set up.</p>;
  }

  const database = getDb();
  const days = scheduleDayChoices(
    tournamentDays(tournament.startsOn, tournament.endsOn),
    listScheduleDaysInUse(database, tournament.id),
  );
  const requested = (await searchParams).day;
  const day =
    typeof requested === "string" && days.includes(requested)
      ? requested
      : defaultScheduleDay(days, venueDay(new Date().getTime()));
  if (day === null) {
    return <p className="p-6 text-[13px] text-muted">Set the tournament&apos;s start date in Settings first.</p>;
  }

  const published = getPublishedDay(database, tournament.id, day);
  const working = listScheduleItems(database, tournament.id, day).map(scheduleEntryOf);
  const rowsById = new Map(listScoringMatches(database, tournament.id).map((row) => [row.match.id, row]));
  const entries = (published?.items ?? []).filter(
    (entry) => entry.matchId === null || rowsById.has(entry.matchId),
  );
  const columns = courtColumns(listCourts(database, tournament.id), entries).filter(
    (column) => column.items.length > 0,
  );
  const names = listNamesByEmail(database, [
    ...new Set(entries.flatMap((entry) => (entry.umpireEmail === null ? [] : [entry.umpireEmail]))),
  ]);
  const matchNumberOf = (matchId: string | null): number | null =>
    matchId === null ? null : (rowsById.get(matchId)?.match.matchNumber ?? null);
  const dayLabel = formatScheduleDay(day);

  return (
    <div className="mx-auto max-w-4xl bg-surface-1 px-6 py-6 print:max-w-none print:p-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`${ADMIN_ORDER_OF_PLAY_PATH}?day=${day}`} className="caps">
          Back to order of play
        </Link>
        {published === null ? null : <PrintButton />}
      </div>

      <header className="border-b-2 border-ink pb-3">
        <div className="eyebrow">{tournament.name}</div>
        <h1 className="mt-1.5 text-[24px] font-semibold tracking-[-0.02em]">Order of play · {dayLabel}</h1>
        <p className="mono mt-1.5 text-[11px] uppercase text-dim">
          {[tournament.venue, published === null ? null : `Published ${venueClock(published.publishedAt)}`]
            .filter((part) => part !== null)
            .join(" · ")}
        </p>
      </header>

      {published !== null && hasUnpublishedChanges(working, published.items) ? (
        <p className="mt-4 border border-line p-3 text-[12px] text-warn print:hidden" role="status">
          This sheet shows the published order of play. Publish the changes first to print them.
        </p>
      ) : null}

      {published === null ? (
        <p className="mt-5 text-[13px] text-muted" role="status">
          The order of play for {dayLabel} has not been published. Publish it to print this sheet.
        </p>
      ) : columns.length === 0 ? (
        <p className="mt-5 text-[13px] text-muted" role="status">
          Nothing is on court for {dayLabel}.
        </p>
      ) : (
        columns.map((column) => {
          const detail = courtDetail(column.court);
          return (
            <section
              key={column.number}
              aria-labelledby={`print-court-${column.number}`}
              className="mt-6 break-inside-avoid"
            >
              <h2 id={`print-court-${column.number}`} className="text-[15px] font-semibold">
                {courtTitle(column.number)}
                {detail === null ? null : <span className="font-normal text-muted"> · {detail}</span>}
              </h2>
              <table className="mt-2 w-full border-collapse text-[12px]">
                <thead>
                  <tr className="thead">
                    <th scope="col" className={`${CELL} w-[112px] font-normal`}>
                      Time
                    </th>
                    <th scope="col" className={`${CELL} w-[190px] font-normal`}>
                      Match
                    </th>
                    <th scope="col" className={`${CELL} font-normal`}>
                      Players
                    </th>
                    <th scope="col" className={`${CELL} w-[150px] font-normal`}>
                      Umpire
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {column.items.map((entry, index) => {
                    const above = index === 0 ? null : column.items[index - 1];
                    const timing = timingLabel(
                      entry,
                      above === null ? null : itemName(above, matchNumberOf(above.matchId)),
                    );
                    const row = entry.matchId === null ? null : (rowsById.get(entry.matchId) ?? null);
                    if (row === null) {
                      return (
                        <tr key={entry.id}>
                          <td className={`${CELL} mono`}>{timing}</td>
                          <td className={CELL} colSpan={3}>
                            <span className="font-semibold">{entry.title}</span>
                            {entry.note === null ? null : <span className="text-muted"> · {entry.note}</span>}
                          </td>
                        </tr>
                      );
                    }
                    const { match } = row;
                    return (
                      <tr key={entry.id}>
                        <td className={`${CELL} mono`}>{timing}</td>
                        <td className={CELL}>
                          <span className="mono">M{match.matchNumber}</span> · {CATEGORY_LABELS[row.category]} ·{" "}
                          {match.roundName}
                        </td>
                        <td className={CELL}>
                          {sideLabel(row.top, match.topSlot).name} v {sideLabel(row.bottom, match.bottomSlot).name}
                        </td>
                        <td className={CELL}>
                          {entry.umpireEmail === null ? "" : (names.get(entry.umpireEmail) ?? entry.umpireEmail)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          );
        })
      )}
    </div>
  );
}
