import { SIDES, other, type MatchState, type Side } from "@/lib/match";

/** A set prediction closes once either side reaches this many games. */
export const PREDICTION_CLOSES_AT_GAMES = 5;
export const POINTS_PER_CORRECT_SET = 1;
const PERCENT = 100;

/** The wording the designed screen carries, and the limit the README sets. */
export const PREDICTION_DISCLAIMER =
  "Predictions are for fun. No entry fee and no cash prize — you are playing for the tournament leaderboard only.";

export interface PredictionTally {
  votes: Record<Side, number>;
  /** Whole percentages that add up to 100, or zero each when nobody has voted. */
  share: Record<Side, number>;
  total: number;
}

export interface PredictionOutcome {
  userId: string;
  name: string;
  side: Side;
  /** Who won that set, or null while it is still being played. */
  winner: Side | null;
}

export interface FanScore {
  userId: string;
  name: string;
  points: number;
  correct: number;
  decided: number;
}

/** The set being played now, counting from 1. */
export function currentSetNumber(state: MatchState): number {
  return state.sets.length + 1;
}

/** Whether fans may still pick a winner for the current set. */
export function predictionsOpen(state: MatchState): boolean {
  if (state.status === "completed") return false;
  return Math.max(state.games.top, state.games.bottom) < PREDICTION_CLOSES_AT_GAMES;
}

/** Votes as counts and whole percentages. */
export function tally(votes: Record<Side, number>): PredictionTally {
  const total = votes.top + votes.bottom;
  if (total === 0) return { votes, share: { top: 0, bottom: 0 }, total };
  const top = Math.round((votes.top / total) * PERCENT);
  return { votes, share: { top, bottom: PERCENT - top }, total };
}

/**
 * Who won each completed set, by set number. A set abandoned by a retirement
 * never completes, so nothing is listed for it and its predictions score
 * nothing.
 */
export function setWinners(state: MatchState): Map<number, Side> {
  return new Map(
    state.sets.map((set, index) => {
      const winner: Side = set.games.top > set.games.bottom ? "top" : "bottom";
      return [index + 1, winner];
    }),
  );
}

/** Fans by points, then by name, counting only sets that finished. */
export function leaderboard(outcomes: readonly PredictionOutcome[]): FanScore[] {
  const scores = new Map<string, FanScore>();
  for (const outcome of outcomes) {
    const score = scores.get(outcome.userId) ?? {
      userId: outcome.userId,
      name: outcome.name,
      points: 0,
      correct: 0,
      decided: 0,
    };
    if (outcome.winner !== null) {
      score.decided += 1;
      if (outcome.winner === outcome.side) {
        score.correct += 1;
        score.points += POINTS_PER_CORRECT_SET;
      }
    }
    scores.set(outcome.userId, score);
  }
  return [...scores.values()]
    .filter((score) => score.decided > 0)
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}

/** Counts a list of picks by side. */
export function countVotes(sides: readonly Side[]): Record<Side, number> {
  const votes: Record<Side, number> = { top: 0, bottom: 0 };
  for (const side of sides) votes[side] += 1;
  return votes;
}

/** The side a fan did not pick, for the "change your pick" copy. */
export function otherSide(side: Side): Side {
  return other(side);
}

/** Both sides in a fixed order, for rendering the two prediction bars. */
export const PREDICTION_SIDES: readonly Side[] = SIDES;
