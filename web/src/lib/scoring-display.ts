import type { MatchSideInfo, ScoringMatchRow } from "@/db/matches";
import type { MatchSlot } from "@/db/schema";
import {
  MATCH_TIEBREAK_POINTS,
  advantageSide,
  deriveState,
  isDeuce,
  scoreLine,
  setScores,
  standardFormat,
  type MatchState,
  type Side,
} from "@/lib/match";
import { snapshotOf } from "@/lib/score-sync";

/** How a side appears on the scoring screens. */
export interface SideLabel {
  name: string;
  seed: number | null;
}

export type ScoringGroup = "in_progress" | "ready" | "waiting" | "completed";

export const SCORING_GROUP_ORDER: readonly ScoringGroup[] = [
  "in_progress",
  "ready",
  "waiting",
  "completed",
];

export const SCORING_GROUP_TITLES: Record<ScoringGroup, string> = {
  in_progress: "In progress",
  ready: "Ready to start",
  waiting: "Waiting on earlier results",
  completed: "Completed",
};

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;

export function sideLabel(info: MatchSideInfo | null, slot: MatchSlot): SideLabel {
  switch (slot.kind) {
    case "bye":
      return { name: "Bye", seed: null };
    case "winner":
      return { name: `Winner of M${slot.matchNumber}`, seed: null };
    case "entry":
      if (info === null) throw new Error(`Entry ${slot.entryId} has no player details.`);
      return {
        name: info.partnerName ? `${info.name} / ${info.partnerName}` : info.name,
        seed: info.seed,
      };
  }
}

/** Where a match sits on the scoring list, or null for a bye, which needs no umpire. */
export function scoringGroupOf(row: ScoringMatchRow): ScoringGroup | null {
  const { match } = row;
  if (match.topSlot.kind === "bye" || match.bottomSlot.kind === "bye") return null;
  if (match.status === "completed") return "completed";
  if (match.status === "in_progress") return "in_progress";
  return match.topSlot.kind === "entry" && match.bottomSlot.kind === "entry" ? "ready" : "waiting";
}

/** Rows by scoring group, keeping their order. Byes are left out. */
export function groupScoringMatches(
  rows: readonly ScoringMatchRow[],
): Record<ScoringGroup, ScoringMatchRow[]> {
  const groups: Record<ScoringGroup, ScoringMatchRow[]> = {
    in_progress: [],
    ready: [],
    waiting: [],
    completed: [],
  };
  for (const row of rows) {
    const group = scoringGroupOf(row);
    if (group !== null) groups[group].push(row);
  }
  return groups;
}

/**
 * One score line for the scoring list: sets and current games while in
 * progress, the result from the winner's side once completed. A retirement
 * ends in "ret."; a match retired before it started is a walkover.
 */
export function matchSummary(row: ScoringMatchRow): string | null {
  const snapshot = snapshotOf(row.match);
  const record = snapshot.record;
  if (row.match.status === "scheduled") return null;
  if (record === null) return snapshot.winner === null ? null : "Walkover";

  const state = deriveState(record.events, standardFormat(record.decidingSet), record.firstServer);
  if (row.match.status === "in_progress") {
    return [scoreLine(state.sets, "top"), `${state.games.top}–${state.games.bottom}`]
      .filter((part) => part !== "")
      .join(" ");
  }
  if (snapshot.winner === null) {
    throw new Error(`Completed match ${row.match.matchNumber} has no winner.`);
  }
  const line = scoreLine(state.sets, snapshot.winner);
  return state.status === "completed" ? line : `${line} ret.`.trim();
}

/** What is happening in the current game, such as "Deuce · Second serve", or null. */
export function situationLabel(state: MatchState, sides: Record<Side, SideLabel>): string | null {
  if (state.status === "completed") return null;
  const parts: string[] = [];
  if (state.tiebreak) {
    parts.push(state.tiebreakTarget === MATCH_TIEBREAK_POINTS ? "Match tiebreak" : "Tiebreak");
  } else if (isDeuce(state)) {
    parts.push("Deuce");
  } else {
    const side = advantageSide(state);
    if (side !== null) parts.push(`Advantage ${sides[side].name}`);
  }
  if (state.faultPending) parts.push("Second serve");
  return parts.length === 0 ? null : parts.join(" · ");
}

/**
 * Games in each set for each side, e.g. "6 3", once a match has started: the
 * current set too while it plays, finished sets only once it is over.
 */
export function setGamesBySide(row: ScoringMatchRow): Record<Side, string> | null {
  const record = snapshotOf(row.match).record;
  if (row.match.status === "scheduled" || record === null) return null;
  const state = deriveState(record.events, standardFormat(record.decidingSet), record.firstServer);
  const cells = setScores(state);
  const shown = row.match.status === "completed" ? state.sets.length : cells.top.length;
  return {
    top: cells.top.slice(0, shown).join(" "),
    bottom: cells.bottom.slice(0, shown).join(" "),
  };
}

/** Match time in hours and minutes, e.g. "1:42". */
export function formatElapsed(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / MS_PER_MINUTE));
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}
