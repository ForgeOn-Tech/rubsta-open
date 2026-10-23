import { eq } from "drizzle-orm";

import type { Database } from "./draws";
import { listScoringMatches, type ScoringMatchRow } from "./matches";
import { listEntryPlayers, type EntryPlayer } from "./partners";
import { addMatchItem } from "./schedule";
import { CATEGORIES, CATEGORY_LABELS, scheduleItems, type Category, type MatchSlot, type ScheduleItem } from "./schema";
import {
  courtEnd,
  clockOf,
  expectedMinutes,
  minutesOf,
  planDay,
  timingFor,
  type FillRequest,
  type MatchLengths,
  type PlanMatch,
} from "@/lib/auto-schedule";
import { formatFor } from "@/lib/match-formats";
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

/** Adds the fill to the working order of play, court by court in start order. Returns how many it placed. */
export function applyFill(database: Database, tournamentId: string, request: FillRequest): number {
  return database.transaction((tx) => {
    const plan = buildPlan(tx, tournamentId, request);
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
