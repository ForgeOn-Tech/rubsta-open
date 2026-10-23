import { eq, inArray } from "drizzle-orm";

import type { Database } from "./draws";
import { listScoringMatches, type ScoringMatchRow } from "./matches";
import { listEntryPlayers, type EntryPlayer } from "./partners";
import { ScheduleRejectedError, addMatchItem, courtItems, getScheduleItem, removeItem, renumber, requireCourt } from "./schedule";
import { CATEGORIES, CATEGORY_LABELS, draws, matches, scheduleItems, tournaments, type Category, type MatchSlot, type ScheduleItem } from "./schema";
import {
  DEFAULT_START_TIME,
  courtEnd,
  courtTimeline,
  clockOf,
  expectedMinutes,
  minutesOf,
  planDay,
  positionForTime,
  timingFor,
  type ExpectedSpan,
  type FillRequest,
  type MatchLengths,
  type PlanMatch,
} from "@/lib/auto-schedule";
import { formatFor } from "@/lib/match-formats";
import { isScheduleTime } from "@/lib/schedule";
import { sideLabel } from "@/lib/scoring-display";

/** A round with matches still to place, offered on the fill form. */
export interface FillRound {
  key: string;
  category: Category;
  /** The event, e.g. "Open singles". */
  eventLabel: string;
  label: string;
  matchCount: number;
  /** The round's stage in its event; an event's groups share one. */
  roundIndex: number;
}

export interface FillPreviewRow {
  matchId: string;
  label: string;
  courtNumber: number;
  start: string;
  end: string;
}

export interface FillPreview {
  placed: FillPreviewRow[];
  /** Matches that could not go on, with why. */
  unplaced: { label: string; reason: string }[];
}

export function roundKey(row: Pick<ScoringMatchRow, "category" | "match">): string {
  return `${row.category}|${row.match.roundName}`;
}

function matchLabel(row: ScoringMatchRow): string {
  const top = sideLabel(row.top, row.match.topSlot).name;
  const bottom = sideLabel(row.bottom, row.match.bottomSlot).name;
  return `${CATEGORY_LABELS[row.category]} M${row.match.matchNumber} · ${row.match.roundName} · ${top} v ${bottom}`;
}

/** A match still to play that needs a court: not a bye and not finished. */
function needsCourt(row: ScoringMatchRow): boolean {
  return row.match.status !== "completed" && row.match.topSlot.kind !== "bye" && row.match.bottomSlot.kind !== "bye";
}

/** Rounds with matches that have no place on any day yet, event by event, earliest round first. */
export function listFillRounds(database: Database, tournamentId: string): FillRound[] {
  const scheduled = matchDays(database, tournamentId);
  const open = listScoringMatches(database, tournamentId).filter((row) => needsCourt(row) && !scheduled.has(row.match.id));
  const keys = [...new Set(open.map(roundKey))];
  return keys
    .map((key) => {
      const inRound = open.filter((row) => roundKey(row) === key);
      const [first] = inRound;
      return {
        key,
        category: first.category,
        eventLabel: CATEGORY_LABELS[first.category],
        label: `${CATEGORY_LABELS[first.category]} · ${first.match.roundName}`,
        matchCount: inRound.length,
        roundIndex: first.match.roundIndex,
        sort: [CATEGORIES.indexOf(first.category), first.match.roundIndex, first.match.matchNumber],
      };
    })
    .sort((a, b) => a.sort[0] - b.sort[0] || a.sort[1] - b.sort[1] || a.sort[2] - b.sort[2])
    .map(({ key, category, eventLabel, label, matchCount, roundIndex }) => ({ key, category, eventLabel, label, matchCount, roundIndex }));
}

/** The day each match on the order of play is placed on. */
function matchDays(database: Database, tournamentId: string): Map<string, string> {
  return new Map(
    database
      .select({ matchId: scheduleItems.matchId, day: scheduleItems.day })
      .from(scheduleItems)
      .where(eq(scheduleItems.tournamentId, tournamentId))
      .all()
      .flatMap((row) => (row.matchId === null ? [] : [[row.matchId, row.day] as const])),
  );
}

interface Graph {
  rowOf: (matchId: string) => ScoringMatchRow;
  rowsById: Map<string, ScoringMatchRow>;
  /** The matches whose results fill a slot. */
  feedersOf: (row: ScoringMatchRow, slot: MatchSlot) => ScoringMatchRow[];
  /** Everyone who could play in a slot. */
  playersOf: (row: ScoringMatchRow, slot: MatchSlot) => string[];
}

function graphOf(rows: readonly ScoringMatchRow[], entryPlayers: ReadonlyMap<string, readonly EntryPlayer[]>): Graph {
  const rowsById = new Map(rows.map((row) => [row.match.id, row]));
  const feedersOf = (row: ScoringMatchRow, slot: MatchSlot): ScoringMatchRow[] => {
    const inDraw = rows.filter((other) => other.match.drawId === row.match.drawId);
    if (slot.kind === "winner") return inDraw.filter((other) => other.match.matchNumber === slot.matchNumber);
    if (slot.kind === "group") return inDraw.filter((other) => other.match.groupNumber === slot.group);
    return [];
  };
  const playersOf = (row: ScoringMatchRow, slot: MatchSlot): string[] => {
    if (slot.kind === "entry") return (entryPlayers.get(slot.entryId) ?? []).map((player) => player.userId);
    if (slot.kind === "bye") return [];
    const everyone = feedersOf(row, slot).flatMap((feeder) => [
      ...playersOf(feeder, feeder.match.topSlot),
      ...playersOf(feeder, feeder.match.bottomSlot),
    ]);
    return [...new Set(everyone)];
  };
  const rowOf = (matchId: string): ScoringMatchRow => {
    const row = rowsById.get(matchId);
    if (!row) throw new Error(`Match ${matchId} is not in the tournament.`);
    return row;
  };
  return { rowOf, rowsById, feedersOf, playersOf };
}

/** Order to place matches: round by round, group rounds interleaved, then event and number. */
function placingOrder(rows: readonly ScoringMatchRow[]): ScoringMatchRow[] {
  const groupRound = (row: ScoringMatchRow): number => {
    if (row.match.groupNumber === null) return 0;
    const group = rows
      .filter((other) => other.match.drawId === row.match.drawId && other.match.groupNumber === row.match.groupNumber)
      .sort((a, b) => a.match.matchNumber - b.match.matchNumber);
    const members = new Set(
      group.flatMap((other) => [other.match.topSlot, other.match.bottomSlot].flatMap((slot) => (slot.kind === "entry" ? [slot.entryId] : []))),
    ).size;
    // Each round of a group of n has n/2 matches, rounded down.
    const perRound = Math.max(1, Math.floor(members / 2));
    return Math.floor(group.findIndex((other) => other.match.id === row.match.id) / perRound);
  };
  return [...rows].sort(
    (a, b) =>
      a.match.roundIndex - b.match.roundIndex ||
      groupRound(a) - groupRound(b) ||
      CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) ||
      a.match.matchNumber - b.match.matchNumber,
  );
}

interface Plan {
  placed: { row: ScoringMatchRow; courtNumber: number; start: number; end: number }[];
  unplaced: { row: ScoringMatchRow; reason: string }[];
  /** When each selected court's existing items end; null for an empty court. */
  courtEnds: Map<number, number | null>;
}

function minutesFor(row: ScoringMatchRow, lengths: MatchLengths): number {
  return expectedMinutes(row.match.format ?? formatFor(row.category, row.match.roundName), lengths);
}

function buildPlan(database: Database, tournamentId: string, request: FillRequest): Plan {
  const rows = listScoringMatches(database, tournamentId);
  const graph = graphOf(rows, listEntryPlayers(database, tournamentId));
  const days = matchDays(database, tournamentId);
  const dayStart = minutesOf(request.startTime);

  // What is already on this day: each court's end, each match's expected end, each player's last finish.
  const items: ScheduleItem[] = database
    .select()
    .from(scheduleItems)
    .where(eq(scheduleItems.tournamentId, tournamentId))
    .all()
    .filter((item) => item.day === request.day)
    .sort((a, b) => a.courtNumber - b.courtNumber || a.position - b.position);
  const existingEnd = new Map<string, number>();
  const busyUntil = new Map<string, number>();
  const courtEnds = new Map<number, number | null>();
  const courtNumbers = [...new Set([...items.map((item) => item.courtNumber), ...request.courts])];
  for (const courtNumber of courtNumbers) {
    const onCourt = items.filter((item) => item.courtNumber === courtNumber);
    const timings = onCourt.map((item) => {
      const row = item.matchId === null ? null : (graph.rowsById.get(item.matchId) ?? null);
      return { timing: item.timing, time: item.time, endTime: item.endTime, minutes: row === null ? null : minutesFor(row, request.lengths) };
    });
    onCourt.forEach((item, index) => {
      const end = courtEnd(timings.slice(0, index + 1), dayStart);
      const row = item.matchId === null ? null : (graph.rowsById.get(item.matchId) ?? null);
      if (row === null || end === null) return;
      existingEnd.set(row.match.id, end);
      for (const player of [...graph.playersOf(row, row.match.topSlot), ...graph.playersOf(row, row.match.bottomSlot)]) {
        busyUntil.set(player, Math.max(busyUntil.get(player) ?? 0, end));
      }
    });
    if (request.courts.includes(courtNumber)) courtEnds.set(courtNumber, courtEnd(timings, dayStart));
  }

  const chosen = placingOrder(
    rows.filter((row) => needsCourt(row) && !days.has(row.match.id) && request.rounds.includes(roundKey(row))),
  );
  const chosenIds = new Set(chosen.map((row) => row.match.id));
  const unplaced: Plan["unplaced"] = [];
  const planMatches: PlanMatch[] = [];
  for (const row of chosen) {
    const feeders = [row.match.topSlot, row.match.bottomSlot].flatMap((slot) => graph.feedersOf(row, slot));
    const eventStart = request.eventStarts[row.category];
    let readyAt = eventStart === undefined ? dayStart : Math.max(dayStart, minutesOf(eventStart));
    const after: string[] = [];
    let reason: string | null = null;
    for (const feeder of feeders) {
      if (feeder.match.status === "completed") continue;
      if (chosenIds.has(feeder.match.id)) {
        after.push(feeder.match.id);
      } else if (existingEnd.has(feeder.match.id)) {
        readyAt = Math.max(readyAt, (existingEnd.get(feeder.match.id) ?? dayStart) + request.restMinutes);
      } else {
        const day = days.get(feeder.match.id);
        if (day === undefined || day > request.day) reason = `It waits on M${feeder.match.matchNumber}, which has no earlier place.`;
      }
    }
    if (reason !== null) {
      unplaced.push({ row, reason });
      continue;
    }
    planMatches.push({
      id: row.match.id,
      players: [...new Set([...graph.playersOf(row, row.match.topSlot), ...graph.playersOf(row, row.match.bottomSlot)])],
      readyAt,
      after,
      minutes: minutesFor(row, request.lengths),
    });
  }

  const plan = planDay({
    courts: request.courts.map((courtNumber) => ({ courtNumber, freeFrom: Math.max(dayStart, courtEnds.get(courtNumber) ?? dayStart) })),
    matches: planMatches,
    restMinutes: request.restMinutes,
    busyUntil,
    latestStart: request.finishBy === null ? null : minutesOf(request.finishBy),
  });
  return {
    placed: plan.placed.map((placed) => ({ ...placed, row: graph.rowOf(placed.matchId) })),
    unplaced: [
      ...unplaced,
      ...plan.unplaced.map((item) => ({
        row: graph.rowOf(item.matchId),
        reason:
          item.reason === "late"
            ? `It would start after ${request.finishBy ?? ""}, the last start.`
            : "It waits on a match that could not be placed.",
      })),
    ],
    courtEnds,
  };
}

/** What a fill would add, without changing anything. */
export function previewFill(database: Database, tournamentId: string, request: FillRequest): FillPreview {
  const plan = buildPlan(database, tournamentId, request);
  return {
    placed: plan.placed
      .sort((a, b) => a.courtNumber - b.courtNumber || a.start - b.start)
      .map((item) => ({ matchId: item.row.match.id, label: matchLabel(item.row), courtNumber: item.courtNumber, start: clockOf(item.start), end: clockOf(item.end) })),
    unplaced: plan.unplaced.map((item) => ({ label: matchLabel(item.row), reason: item.reason })),
  };
}

/**
 * Adds the fill to the working order of play, court by court in start order, and keeps its rest
 * and match lengths for the next fill and the grid. Returns how many it placed.
 */
export function applyFill(database: Database, tournamentId: string, request: FillRequest): number {
  return database.transaction((tx) => {
    const plan = buildPlan(tx, tournamentId, request);
    tx.update(tournaments)
      .set({
        scheduleRestMinutes: request.restMinutes,
        oneSetMinutes: request.lengths.oneSet,
        eightGamesMinutes: request.lengths.eightGames,
        bestOfThreeMinutes: request.lengths.bestOfThree,
      })
      .where(eq(tournaments.id, tournamentId))
      .run();
    for (const courtNumber of request.courts) {
      let previousEnd = plan.courtEnds.get(courtNumber) ?? null;
      const onCourt = plan.placed.filter((item) => item.courtNumber === courtNumber).sort((a, b) => a.start - b.start);
      for (const item of onCourt) {
        const timing = timingFor(item.start, previousEnd);
        addMatchItem(tx, tournamentId, {
          day: request.day,
          courtNumber,
          matchId: item.row.match.id,
          timing: timing.timing,
          time: timing.time,
          umpireEmail: null,
        });
        previousEnd = item.end;
      }
    }
    return plan.placed.length;
  });
}

/** A court's first item with no time of its own starts at this time on the grid. */
const GRID_DAY_START = minutesOf(DEFAULT_START_TIME);

/** Expected minutes for each match item among `items`; a session runs to its end time. */
function itemMinutes(database: Database, items: readonly ScheduleItem[], lengths: MatchLengths): Map<string, number> {
  const matchIds = items.flatMap((item) => (item.matchId === null ? [] : [item.matchId]));
  if (matchIds.length === 0) return new Map();
  const rows = database
    .select({ id: matches.id, format: matches.format, roundName: matches.roundName, category: draws.category })
    .from(matches)
    .innerJoin(draws, eq(matches.drawId, draws.id))
    .where(inArray(matches.id, matchIds))
    .all();
  const byMatch = new Map(rows.map((row) => [row.id, expectedMinutes(row.format ?? formatFor(row.category, row.roundName), lengths)]));
  return new Map(items.flatMap((item) => (item.matchId === null || !byMatch.has(item.matchId) ? [] : [[item.id, byMatch.get(item.matchId) as number]])));
}

function spansOf(database: Database, onCourt: readonly ScheduleItem[], lengths: MatchLengths): ExpectedSpan[] {
  const minutes = itemMinutes(database, onCourt, lengths);
  return courtTimeline(
    onCourt.map((item) => ({ timing: item.timing, time: item.time, endTime: item.endTime, minutes: minutes.get(item.id) ?? null })),
    GRID_DAY_START,
  );
}

/** One item of a day's order of play with when it is expected to play, for the grid. */
export interface TimedItem {
  item: ScheduleItem;
  start: number;
  end: number;
}

/** A day's working order of play with each item's expected start and finish, court by court. */
export function listTimedItems(database: Database, tournamentId: string, day: string, lengths: MatchLengths): TimedItem[] {
  const items = database
    .select()
    .from(scheduleItems)
    .where(eq(scheduleItems.tournamentId, tournamentId))
    .all()
    .filter((item) => item.day === day)
    .sort((a, b) => a.courtNumber - b.courtNumber || a.position - b.position);
  return [...new Set(items.map((item) => item.courtNumber))].flatMap((courtNumber) => {
    const onCourt = items.filter((item) => item.courtNumber === courtNumber);
    const spans = spansOf(database, onCourt, lengths);
    return onCourt.map((item, index) => ({ item, ...spans[index] }));
  });
}

/** A match item that may still move: refused for a session, or a match under way or finished. */
function movableItem(database: Database, itemId: string): ScheduleItem {
  const item = getScheduleItem(database, itemId);
  if (item.kind !== "match" || item.matchId === null) throw new ScheduleRejectedError("Only matches move on the grid.");
  const match = database.select().from(matches).where(eq(matches.id, item.matchId)).get();
  if (!match) throw new Error(`Schedule item ${itemId} points at match ${item.matchId}, which does not exist.`);
  if (match.status !== "scheduled") {
    throw new ScheduleRejectedError(`M${match.matchNumber} has started, so it stays on Court ${item.courtNumber}.`);
  }
  return item;
}

/**
 * Moves a match to a court and a time on the same day. It goes in the court's list before the
 * first item expected to start at that time or later, and waits for that time; items below it
 * that follow on move later with it. A fixed time just below becomes "not before", so the two
 * cannot overlap. On the court it leaves, items that follow on move up into the gap, and a new
 * first item keeps the moved match's start. A match under way or finished stays where it is.
 */
export function moveItemToSlot(
  database: Database,
  itemId: string,
  target: { courtNumber: number; time: string },
  lengths: MatchLengths,
): void {
  if (!isScheduleTime(target.time)) throw new ScheduleRejectedError("Choose a time such as 10:15.");
  database.transaction((tx) => {
    const item = movableItem(tx, itemId);
    requireCourt(tx, item.tournamentId, target.courtNumber);
    const now = Date.now();

    const source = courtItems(tx, item.tournamentId, item.day, item.courtNumber);
    const sourceIndex = source.findIndex((row) => row.id === itemId);
    const oldStart = spansOf(tx, source, lengths)[sourceIndex].start;

    const others = courtItems(tx, item.tournamentId, item.day, target.courtNumber).filter((row) => row.id !== itemId);
    const index = positionForTime(
      spansOf(tx, others, lengths).map((span) => span.start),
      minutesOf(target.time),
    );
    tx.update(scheduleItems)
      .set({ courtNumber: target.courtNumber, timing: "notBefore", time: target.time, updatedAt: now })
      .where(eq(scheduleItems.id, itemId))
      .run();
    const below = others[index];
    if (below !== undefined && below.timing === "at") {
      tx.update(scheduleItems).set({ timing: "notBefore", updatedAt: now }).where(eq(scheduleItems.id, below.id)).run();
    }
    renumber(tx, [...others.slice(0, index), item, ...others.slice(index)].map((row) => row.id));

    if (item.courtNumber !== target.courtNumber) renumber(tx, source.filter((row) => row.id !== itemId).map((row) => row.id));
    const [first] = courtItems(tx, item.tournamentId, item.day, item.courtNumber);
    if (sourceIndex === 0 && first !== undefined && first.id !== itemId && first.timing === "followOn") {
      // Nothing above it any more, so it takes the start the moved match had.
      tx.update(scheduleItems).set({ timing: "at", time: clockOf(oldStart), updatedAt: now }).where(eq(scheduleItems.id, first.id)).run();
    }
  });
}

/** Puts a match with no place yet on a court at a time, where moving it there would. */
export function placeMatchAtSlot(
  database: Database,
  tournamentId: string,
  placement: { day: string; matchId: string; courtNumber: number; time: string },
  lengths: MatchLengths,
): void {
  if (!isScheduleTime(placement.time)) throw new ScheduleRejectedError("Choose a time such as 10:15.");
  const { day, matchId, courtNumber, time } = placement;
  database.transaction((tx) => {
    const item = addMatchItem(tx, tournamentId, { day, courtNumber, matchId, timing: "notBefore", time, umpireEmail: null });
    moveItemToSlot(tx, item.id, { courtNumber, time }, lengths);
  });
}

/** Takes a match that has not started off the order of play, back to the grid's tray. */
export function unscheduleItem(database: Database, itemId: string): void {
  database.transaction((tx) => {
    movableItem(tx, itemId);
    removeItem(tx, itemId);
  });
}
