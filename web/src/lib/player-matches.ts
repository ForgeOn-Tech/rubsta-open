import type { ScoringMatchRow } from "@/db/matches";
import type { Side } from "@/lib/match";
import type { PublishedPlace } from "@/lib/schedule";

export const PLAYER_DRAWS_PATH = "/draws";
export const PLAYER_ORDER_OF_PLAY_PATH = "/order-of-play";

export interface DrawRound {
  roundIndex: number;
  name: string;
  rows: ScoringMatchRow[];
}

/** The side one of `entryIds` plays on, or null when none of them is in the match. */
export function teamSide(row: Pick<ScoringMatchRow, "match">, entryIds: ReadonlySet<string>): Side | null {
  const { topSlot, bottomSlot } = row.match;
  if (topSlot.kind === "entry" && entryIds.has(topSlot.entryId)) return "top";
  if (bottomSlot.kind === "entry" && entryIds.has(bottomSlot.entryId)) return "bottom";
  return null;
}

/** Matches one of `entryIds` plays or has played. Byes are left out. */
export function teamMatches(
  rows: readonly ScoringMatchRow[],
  entryIds: ReadonlySet<string>,
): ScoringMatchRow[] {
  return rows.filter(
    (row) =>
      row.match.topSlot.kind !== "bye" &&
      row.match.bottomSlot.kind !== "bye" &&
      teamSide(row, entryIds) !== null,
  );
}

/**
 * The match a player looks at next: one in play, then the earliest on the
 * published order of play, then the earliest round still to play.
 */
export function nextMatch(
  rows: readonly ScoringMatchRow[],
  entryIds: ReadonlySet<string>,
  places: ReadonlyMap<string, PublishedPlace>,
): ScoringMatchRow | null {
  const open = teamMatches(rows, entryIds).filter((row) => row.match.status !== "completed");
  const live = open.find((row) => row.match.status === "in_progress");
  if (live) return live;

  const placed = open
    .flatMap((row) => {
      const place = places.get(row.match.id);
      return place === undefined ? [] : [{ row, place }];
    })
    .sort(
      (a, b) =>
        a.place.day.localeCompare(b.place.day) ||
        a.place.courtNumber - b.place.courtNumber ||
        a.place.position - b.place.position,
    );
  if (placed.length > 0) return placed[0].row;

  const byRound = [...open].sort(
    (a, b) => a.match.roundIndex - b.match.roundIndex || a.match.matchNumber - b.match.matchNumber,
  );
  return byRound[0] ?? null;
}

/** A draw's matches by round, first round first, each round in match number order. */
export function drawRounds(rows: readonly ScoringMatchRow[]): DrawRound[] {
  const roundIndexes = [...new Set(rows.map((row) => row.match.roundIndex))].sort((a, b) => a - b);
  return roundIndexes.map((roundIndex) => {
    const inRound = rows
      .filter((row) => row.match.roundIndex === roundIndex)
      .sort((a, b) => a.match.matchNumber - b.match.matchNumber);
    return { roundIndex, name: inRound[0].match.roundName, rows: inRound };
  });
}
