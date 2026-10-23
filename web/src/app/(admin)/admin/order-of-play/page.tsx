import Link from "next/link";

import {
  addMatchToScheduleAction,
  changeScheduleItemAction,
  fillScheduleAction,
  gridDropAction,
  publishDayAction,
  undoWalkoverAction,
  walkoverAction,
} from "./actions";
import { AddToSchedule, type MatchChoice } from "./add-to-schedule";
import { FillSchedule } from "./fill-schedule";
import { PublishDayButton } from "./publish-day-button";
import { ScheduleGrid, type GridCard } from "./schedule-grid";
import { ScheduleItemEditor } from "./schedule-item-editor";
import { UndoWalkoverButton, WalkoverButton } from "./walkover-button";
import { listScorerEmails, requireAdmin } from "@/auth/require";
import { AdminNotice } from "@/components/admin-notice";
import { AdminPageHeader } from "@/components/admin-page-header";
import { ScheduleCard } from "@/components/schedule-card";
import { dependencyWarnings, listFillRounds, listTimedItems, type TimedItem } from "@/db/auto-schedule";
import { getDb } from "@/db/client";
import { listCourts } from "@/db/courts";
import { isWalkover, listScoringMatches, type ScoringMatchRow } from "@/db/matches";
import { listEntryPlayers } from "@/db/partners";
import { getCurrentTournament } from "@/db/queries";
import {
  getPublishedDay,
  listNamesByEmail,
  listScheduleDaysInUse,
  listScheduleItems,
  listScheduledMatchIds,
} from "@/db/schedule";
import { CATEGORIES, CATEGORY_LABELS } from "@/db/schema";
import { expectedMinutes, scheduleSettingsOf, type MatchLengths } from "@/lib/auto-schedule";
import { countLabel } from "@/lib/format";
import { formatFor } from "@/lib/match-formats";
import {
  ADMIN_ORDER_OF_PLAY_PATH,
  courtColumns,
  courtDetail,
  courtOptionLabel,
  courtTitle,
  defaultScheduleDay,
  formatScheduleDay,
  hasUnpublishedChanges,
  itemName,
  playFrom,
  scheduleDayChoices,
  scheduleEntryOf,
  type ScheduleEntry,
  timingLabel,
  tournamentDays,
  venueClock,
  venueDay,
} from "@/lib/schedule";
import { sameDayWarnings, timingClashes } from "@/lib/schedule-clashes";
import { gridRange } from "@/lib/schedule-grid";
import { scoringGroupOf, sideLabel } from "@/lib/scoring-display";

export const dynamic = "force-dynamic";

function matchChoiceLabel(row: ScoringMatchRow): string {
  const { match } = row;
  const top = sideLabel(row.top, match.topSlot).name;
  const bottom = sideLabel(row.bottom, match.bottomSlot).name;
  return `M${match.matchNumber} · ${match.roundName} · ${top} v ${bottom}`;
}

/** Matches that still need a place: not byes, not finished, not on any day. Earliest round first. */
function matchChoices(rows: readonly ScoringMatchRow[], scheduled: ReadonlySet<string>): MatchChoice[] {
  return rows
    .filter(
      (row) =>
        scoringGroupOf(row) !== null && row.match.status !== "completed" && !scheduled.has(row.match.id),
    )
    .sort(
      (a, b) =>
        CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) ||
        a.match.roundIndex - b.match.roundIndex ||
        a.match.matchNumber - b.match.matchNumber,
    )
    .map((row) => ({ id: row.match.id, group: CATEGORY_LABELS[row.category], label: matchChoiceLabel(row) }));
}

const VIEWS = ["grid", "list"] as const;
type View = (typeof VIEWS)[number];
const VIEW_LABELS: Record<View, string> = { grid: "Grid", list: "List" };

function gridTitle(row: ScoringMatchRow): string {
  return `${CATEGORY_LABELS[row.category]} · ${row.match.roundName} · M${row.match.matchNumber}`;
}

function gridPlayers(row: ScoringMatchRow): string {
  return `${sideLabel(row.top, row.match.topSlot).name} v ${sideLabel(row.bottom, row.match.bottomSlot).name}`;
}

function badgeOf(row: ScoringMatchRow): string | null {
  if (row.match.status === "in_progress") return "Live";
  return row.match.status === "completed" ? "Done" : null;
}

/** The day's placed items and the tray's unplaced matches as grid cards. */
function gridCards(input: {
  timed: readonly TimedItem[];
  unplaced: readonly ScoringMatchRow[];
  rowOf: (matchId: string | null) => ScoringMatchRow | null;
  warnings: ReadonlyMap<string, readonly string[]>;
  lengths: MatchLengths;
}): GridCard[] {
  const placed = input.timed.map(({ item, start, end }): GridCard => {
    const row = input.rowOf(item.matchId);
    return {
      key: item.id,
      itemId: item.id,
      matchId: item.matchId,
      title: row === null ? (item.title ?? "Session") : gridTitle(row),
      players: row === null ? null : gridPlayers(row),
      courtNumber: item.courtNumber,
      start,
      minutes: Math.max(end - start, 1),
      locked: row === null || row.match.status !== "scheduled",
      badge: row === null ? "Session" : badgeOf(row),
      warnings: row === null ? [] : [...(input.warnings.get(row.match.id) ?? [])],
    };
  });
  const tray = input.unplaced.map(
    (row): GridCard => ({
      key: row.match.id,
      itemId: null,
      matchId: row.match.id,
      title: gridTitle(row),
      players: gridPlayers(row),
      courtNumber: null,
      start: null,
      minutes: expectedMinutes(row.match.format ?? formatFor(row.category, row.match.roundName), input.lengths),
      locked: false,
      badge: null,
      warnings: [],
    }),
  );
  return [...placed, ...tray];
}

/** Organiser order of play from design/screens/OrderOfPlay.dc.html: a court × time grid, or one list per court. */
export default async function AdminOrderOfPlayPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string | string[]; view?: string | string[] }>;
}) {
  await requireAdmin();
  const tournament = getCurrentTournament();
  if (!tournament) return <AdminNotice message="No tournament has been set up." />;

  const database = getDb();
  const days = scheduleDayChoices(
    tournamentDays(tournament.startsOn, tournament.endsOn),
    listScheduleDaysInUse(database, tournament.id),
  );
  const params = await searchParams;
  const requested = params.day;
  const view: View = VIEWS.find((option) => option === params.view) ?? "grid";
  const day =
    typeof requested === "string" && days.includes(requested)
      ? requested
      : defaultScheduleDay(days, venueDay(new Date().getTime()));
  if (day === null) {
    return <AdminNotice message="Set the tournament's start date in Settings to build the order of play." />;
  }

  const courts = listCourts(database, tournament.id);
  const entries = listScheduleItems(database, tournament.id, day).map(scheduleEntryOf);
  const published = getPublishedDay(database, tournament.id, day);
  const changed = hasUnpublishedChanges(entries, published?.items ?? null);
  const rows = listScoringMatches(database, tournament.id);
  const rowsById = new Map(rows.map((row) => [row.match.id, row]));
  const rowOf = (matchId: string | null): ScoringMatchRow | null => {
    if (matchId === null) return null;
    const row = rowsById.get(matchId);
    if (!row) throw new Error(`Match ${matchId} on the order of play does not exist.`);
    return row;
  };

  const scorerEmails = listScorerEmails();
  const assignedEmails = entries.flatMap((entry) => (entry.umpireEmail === null ? [] : [entry.umpireEmail]));
  const names = listNamesByEmail(database, [...new Set([...scorerEmails, ...assignedEmails])]);
  const umpires = scorerEmails.map((email) => ({ email, label: names.get(email) ?? email }));
  const courtOptions = courts.map((court) => ({ number: court.number, label: courtOptionLabel(court) }));

  const entryPlayers = listEntryPlayers(database, tournament.id);
  const columns = courtColumns(courts, entries);
  const previousNameOf = (items: readonly ScheduleEntry[], index: number): string | null => {
    const above = index === 0 ? null : items[index - 1];
    return above === null ? null : itemName(above, rowOf(above.matchId)?.match.matchNumber ?? null);
  };
  const warnings = sameDayWarnings(
    columns.flatMap((column) =>
      column.items.flatMap((entry, index) => {
        const row = rowOf(entry.matchId);
        if (row === null) return [];
        // "After M10" would be unclear from another court, where M10 is out of sight and
        // match numbers restart in each event, so a match that follows on gives its place.
        const when = entry.timing === "followOn" ? `match ${index + 1} on court` : timingLabel(entry, previousNameOf(column.items, index));
        return [{ row, place: `${courtTitle(column.number)} · ${when}` }];
      }),
    ),
    entryPlayers,
  );
  const matchRows = entries.flatMap((entry) => {
    const row = rowOf(entry.matchId);
    return row === null ? [] : [row];
  });
  const settings = scheduleSettingsOf(tournament);
  const timed = listTimedItems(database, tournament.id, day, settings.lengths);
  const gridClashes = timingClashes(
    timed.flatMap(({ item, start, end }) => {
      const row = rowOf(item.matchId);
      return row === null ? [] : [{ row, courtNumber: item.courtNumber, start, end }];
    }),
    entryPlayers,
    settings.restMinutes,
  );
  const waits = dependencyWarnings(database, tournament.id, day, timed, settings.restMinutes);
  const gridWarnings = new Map(
    [...new Set([...gridClashes.keys(), ...waits.keys()])].map((matchId) => [
      matchId,
      [...(waits.get(matchId) ?? []), ...(gridClashes.get(matchId) ?? [])],
    ]),
  );
  const scheduledIds = listScheduledMatchIds(database, tournament.id);
  const unplaced = rows
    .filter((row) => scoringGroupOf(row) !== null && row.match.status !== "completed" && !scheduledIds.has(row.match.id))
    .sort(
      (a, b) =>
        CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) ||
        a.match.roundIndex - b.match.roundIndex ||
        a.match.matchNumber - b.match.matchNumber,
    );
  const start = playFrom(entries);
  const dayLabel = formatScheduleDay(day);
  const stats = [
    start === null ? "No times yet" : `Play from ${start}`,
    countLabel(columns.length, "court", "courts"),
    countLabel(matchRows.length, "match", "matches"),
    `${matchRows.filter((row) => row.match.status === "in_progress").length} live`,
    published === null ? "Not published" : `Published ${venueClock(published.publishedAt)}`,
    ...(published !== null && changed ? ["Unpublished changes"] : []),
  ];

  return (
    <>
      <AdminPageHeader eyebrow={`${tournament.name} · ${dayLabel}`} title="Order of play" stats={stats}>
        <nav aria-label="View" className="flex flex-wrap border border-line">
          {VIEWS.map((option) => {
            const current = option === view;
            return (
              <Link
                key={option}
                href={`${ADMIN_ORDER_OF_PLAY_PATH}?day=${day}&view=${option}`}
                aria-current={current ? "page" : undefined}
                className={`flex h-8 items-center border-line px-3.5 text-[12px] [&:not(:first-child)]:border-l ${
                  current ? "bg-surface-2 font-semibold" : ""
                }`}
                style={{ color: current ? "var(--color-ink)" : "var(--color-muted)" }}
              >
                {VIEW_LABELS[option]}
              </Link>
            );
          })}
        </nav>
        <nav aria-label="Days" className="flex flex-wrap border border-line">
          {days.map((option) => {
            const current = option === day;
            return (
              <Link
                key={option}
                href={`${ADMIN_ORDER_OF_PLAY_PATH}?day=${option}&view=${view}`}
                aria-current={current ? "page" : undefined}
                className={`flex h-8 items-center border-line px-3.5 text-[12px] [&:not(:first-child)]:border-l ${
                  current ? "bg-surface-2 font-semibold" : ""
                }`}
                // Inline colour: the global `a` rule is unlayered and outranks utilities.
                style={{ color: current ? "var(--color-ink)" : "var(--color-muted)" }}
              >
                {formatScheduleDay(option)}
              </Link>
            );
          })}
        </nav>
        <Link
          href={`${ADMIN_ORDER_OF_PLAY_PATH}/print?day=${day}`}
          className="btn btn-outline h-8 text-[12px]"
          style={{ color: "var(--color-muted)" }}
        >
          Print sheet
        </Link>
        <PublishDayButton
          day={day}
          published={published !== null}
          changed={changed}
          action={publishDayAction}
        />
      </AdminPageHeader>

      <div className="flex flex-col gap-6 p-6">
        {courts.length === 0 ? (
          <p className="card p-4 text-[13px] text-muted" role="status">
            Add courts in <Link href="/admin/settings">Settings</Link> to build the order of play.
          </p>
        ) : view === "grid" ? null : (
          <AddToSchedule
            day={day}
            dayLabel={dayLabel}
            courts={courtOptions}
            umpires={umpires}
            matches={matchChoices(rows, scheduledIds)}
            addMatchAction={addMatchToScheduleAction}
          />
        )}

        {courts.length === 0 ? null : (
          <FillSchedule
            key={day}
            day={day}
            dayLabel={dayLabel}
            courts={courtOptions}
            rounds={listFillRounds(database, tournament.id)}
            settings={settings}
            action={fillScheduleAction}
          />
        )}

        {courts.length === 0 || view !== "grid" ? null : (
          <ScheduleGrid
            key={`grid-${day}`}
            day={day}
            courts={courtOptions}
            cards={gridCards({ timed, unplaced, rowOf, warnings: gridWarnings, lengths: settings.lengths })}
            range={gridRange(timed)}
            action={gridDropAction}
          />
        )}

        {columns.length === 0 || view !== "list" ? null : (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
            {columns.map((column) => {
              const detail = courtDetail(column.court);
              return (
                <section
                  key={column.number}
                  aria-labelledby={`court-${column.number}-heading`}
                  className="flex min-w-0 flex-col gap-3"
                >
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
                  {column.items.length === 0 ? (
                    <p className="text-[12px] text-dim">Nothing on this court yet.</p>
                  ) : (
                    <ol className="flex flex-col gap-3">
                      {column.items.map((entry, index) => {
                        const row = rowOf(entry.matchId);
                        const previousName = previousNameOf(column.items, index);
                        const clashes = row === null ? [] : (warnings.get(row.match.id) ?? []);
                        return (
                          <li key={entry.id}>
                            <ScheduleCard
                              entry={entry}
                              row={row}
                              previousName={previousName}
                              umpireName={
                                entry.umpireEmail === null ? null : (names.get(entry.umpireEmail) ?? entry.umpireEmail)
                              }
                            >
                              {clashes.length === 0 ? null : (
                                <ul aria-label="Players with another match today" className="mt-2 flex flex-col gap-1">
                                  {clashes.map((clash) => (
                                    <li key={clash} className="text-[11.5px] leading-snug text-warn">
                                      {clash}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {row !== null &&
                              row.match.status === "scheduled" &&
                              row.match.topSlot.kind === "entry" &&
                              row.match.bottomSlot.kind === "entry" ? (
                                <WalkoverButton
                                  matchId={row.match.id}
                                  names={{
                                    top: sideLabel(row.top, row.match.topSlot).name,
                                    bottom: sideLabel(row.bottom, row.match.bottomSlot).name,
                                  }}
                                  action={walkoverAction}
                                />
                              ) : row !== null && isWalkover(row.match) ? (
                                <UndoWalkoverButton matchId={row.match.id} action={undoWalkoverAction} />
                              ) : null}
                              <ScheduleItemEditor
                                entry={entry}
                                name={itemName(entry, row?.match.matchNumber ?? null)}
                                first={index === 0}
                                last={index === column.items.length - 1}
                                courts={courtOptions}
                                umpires={umpires}
                                action={changeScheduleItemAction}
                              />
                            </ScheduleCard>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
