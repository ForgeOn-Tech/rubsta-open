import type { Match } from "@/db/schema";
import type { GroupResult } from "@/lib/groups";
import { SIDES, deriveState, type Side } from "@/lib/match";
import { formatOfRecord, scoreRecordOf } from "@/lib/score-record";

function entryOf(match: Match, side: Side): string {
  const slot = side === "top" ? match.topSlot : match.bottomSlot;
  if (slot.kind !== "entry") throw new Error(`Group match ${match.matchNumber} has no entry on the ${side} side.`);
  return slot.entryId;
}

/**
 * A group match as the standings count it: games from finished sets plus the set under way
 * at a retirement, none for a walkover, and the winner only once it is completed.
 */
export function groupResultOf(match: Match): GroupResult {
  const record = scoreRecordOf(match);
  const games = { top: 0, bottom: 0 };
  if (record !== null) {
    const state = deriveState(record.events, formatOfRecord(record), record.firstServer);
    for (const side of SIDES) {
      games[side] = state.sets.reduce((total, set) => total + set.games[side], 0) + state.games[side];
    }
  }
  return {
    top: entryOf(match, "top"),
    bottom: entryOf(match, "bottom"),
    winner: match.status === "completed" ? match.winnerEntryId : null,
    games,
  };
}
