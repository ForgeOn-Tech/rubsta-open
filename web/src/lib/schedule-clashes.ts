import type { ScoringMatchRow } from "@/db/matches";
import type { EntryPlayer } from "@/db/partners";
import { CATEGORY_LABELS } from "@/db/schema";
import { clockOf } from "@/lib/auto-schedule";
import { courtTitle } from "@/lib/schedule";

/** A match on a day's order of play, with where and when it plays, e.g. "Court 2 · 10:00". */
export interface PlacedMatch {
  row: ScoringMatchRow;
  place: string;
}

/** The people on court in a match. A slot still waiting for a winner has nobody yet. */
function playersIn(row: ScoringMatchRow, entryPlayers: ReadonlyMap<string, readonly EntryPlayer[]>): EntryPlayer[] {
  return [row.match.topSlot, row.match.bottomSlot].flatMap((slot) =>
    slot.kind === "entry" ? (entryPlayers.get(slot.entryId) ?? []) : [],
  );
}

/** Match numbers restart in each event, so the event goes with it, e.g. "Open doubles M12". */
function matchName(row: ScoringMatchRow): string {
  return `${CATEGORY_LABELS[row.category]} M${row.match.matchNumber}`;
}

function shares(player: EntryPlayer, row: ScoringMatchRow, entryPlayers: ReadonlyMap<string, readonly EntryPlayer[]>): boolean {
  return playersIn(row, entryPlayers).some((other) => other.userId === player.userId);
}

/**
 * For each unfinished match on a day, the players who are also in another unfinished match
 * that day, e.g. "Arjun Mehta also plays Open doubles M12 · Court 2 · 10:00". Keyed by match id.
 */
export function sameDayWarnings(
  placed: readonly PlacedMatch[],
  entryPlayers: ReadonlyMap<string, readonly EntryPlayer[]>,
): Map<string, string[]> {
  const open = placed.filter((item) => item.row.match.status !== "completed");
  return new Map(
    open.map((item) => [
      item.row.match.id,
      playersIn(item.row, entryPlayers).flatMap((player) =>
        open
          .filter((other) => other !== item && shares(player, other.row, entryPlayers))
          .map((other) => `${player.name} also plays ${matchName(other.row)} · ${other.place}`),
      ),
    ]),
  );
}

/**
 * The players of a match not yet finished who are in another match in progress, e.g.
 * "Arjun Mehta was still playing Open doubles M12 on Court 2 when this page loaded."
 */
export function busyElsewhereWarnings(
  row: ScoringMatchRow,
  rows: readonly ScoringMatchRow[],
  entryPlayers: ReadonlyMap<string, readonly EntryPlayer[]>,
): string[] {
  if (row.match.status === "completed") return [];
  const live = rows.filter((other) => other.match.id !== row.match.id && other.match.status === "in_progress");
  return playersIn(row, entryPlayers).flatMap((player) =>
    live
      .filter((other) => shares(player, other, entryPlayers))
      .map((other) => {
        const where = other.match.court === null ? "" : ` on ${courtTitle(other.match.court)}`;
        return `${player.name} was still playing ${matchName(other)}${where} when this page loaded.`;
      }),
  );
}

/** A placed match with the court and expected minutes it plays, for the grid. */
export interface TimedMatch {
  row: ScoringMatchRow;
  courtNumber: number;
  start: number;
  end: number;
}

function clashBetween(player: EntryPlayer, item: TimedMatch, other: TimedMatch, restMinutes: number): string | null {
  const overlaps = item.start < other.end && other.start < item.end;
  if (overlaps) return `${player.name} also plays ${matchName(other.row)} on ${courtTitle(other.courtNumber)} at ${clockOf(other.start)}`;
  const after = item.start >= other.end;
  const gap = after ? item.start - other.end : other.start - item.end;
  if (gap >= restMinutes) return null;
  return `${player.name} has ${gap} min rest ${after ? "after" : "before"} ${matchName(other.row)}`;
}

/**
 * For each unfinished match, the players who also play another unfinished match that overlaps
 * it, or that leaves them less than `restMinutes` between the two. Keyed by match id.
 */
export function timingClashes(
  timed: readonly TimedMatch[],
  entryPlayers: ReadonlyMap<string, readonly EntryPlayer[]>,
  restMinutes: number,
): Map<string, string[]> {
  const open = timed.filter((item) => item.row.match.status !== "completed");
  return new Map(
    open.map((item) => [
      item.row.match.id,
      playersIn(item.row, entryPlayers).flatMap((player) =>
        open
          .filter((other) => other !== item && shares(player, other.row, entryPlayers))
          .flatMap((other) => {
            const clash = clashBetween(player, item, other, restMinutes);
            return clash === null ? [] : [clash];
          }),
      ),
    ]),
  );
}
