import type { Category } from "@/db/schema";
import type { MatchFormat } from "@/lib/match";

/**
 * The organiser's formats for the Rubsta Open, by event and round. A match keeps the format
 * it started with, so a change here only reaches matches not yet started.
 */

/** One full set; the first deuce is played out, the second is one deciding point. */
export const ONE_SET: MatchFormat = {
  setsToWin: 1,
  gamesPerSet: 6,
  tiebreakAt: 6,
  // The usual tiebreak: first to 7, won by two.
  tiebreakPoints: 7,
  decidingSet: "set",
  decidingPointAtDeuce: 2,
};

/** First to 8 games, with a tiebreak to 7 at 7–all, as the organiser's sheet says. */
export const EIGHT_GAMES: MatchFormat = {
  setsToWin: 1,
  gamesPerSet: 8,
  tiebreakAt: 7,
  tiebreakPoints: 7,
  decidingSet: "set",
  // Every singles match: the first deuce is played out, the second is one point.
  decidingPointAtDeuce: 2,
};

/** Best of 3 sets, the third a super tiebreak to 10, e.g. 4–6 7–6(7–3) [10–6]. */
export const BEST_OF_THREE: MatchFormat = {
  setsToWin: 2,
  gamesPerSet: 6,
  tiebreakAt: 6,
  tiebreakPoints: 7,
  decidingSet: "matchTiebreak",
  decidingPointAtDeuce: 2,
};

/** Doubles: one full set, every deuce one deciding point. */
export const ONE_SET_DECIDING_POINT: MatchFormat = { ...ONE_SET, decidingPointAtDeuce: 1 };

/** The Open doubles final: best of 3 with a super tiebreak, every deuce still one point. */
export const BEST_OF_THREE_DECIDING_POINT: MatchFormat = { ...BEST_OF_THREE, decidingPointAtDeuce: 1 };

/** Where a match sits in its event: group and early rounds, then the last three rounds. */
type Stage = "early" | "quarter" | "semi" | "final";

/** The stage from a round's name, as lib/draws roundName() writes it. */
function stageOf(roundName: string): Stage {
  if (roundName === "Final") return "final";
  if (roundName === "Semi-finals") return "semi";
  if (roundName === "Quarter-finals") return "quarter";
  return "early";
}

const FORMATS: Record<Category, Record<Stage, MatchFormat>> = {
  // Open singles, U-15 and Women's 30+: one set, 8 games in the quarters, best of 3 after.
  OS: { early: ONE_SET, quarter: EIGHT_GAMES, semi: BEST_OF_THREE, final: BEST_OF_THREE },
  U15: { early: ONE_SET, quarter: EIGHT_GAMES, semi: BEST_OF_THREE, final: BEST_OF_THREE },
  W30: { early: ONE_SET, quarter: EIGHT_GAMES, semi: BEST_OF_THREE, final: BEST_OF_THREE },
  // 40+ singles: one-set groups, then 8-game semi-finals and final.
  S40: { early: ONE_SET, quarter: ONE_SET, semi: EIGHT_GAMES, final: EIGHT_GAMES },
  // 40+ doubles: one set with deciding points throughout.
  D40: {
    early: ONE_SET_DECIDING_POINT,
    quarter: ONE_SET_DECIDING_POINT,
    semi: ONE_SET_DECIDING_POINT,
    final: ONE_SET_DECIDING_POINT,
  },
  // Open doubles: the same, except a best-of-3 final.
  OD: {
    early: ONE_SET_DECIDING_POINT,
    quarter: ONE_SET_DECIDING_POINT,
    semi: ONE_SET_DECIDING_POINT,
    final: BEST_OF_THREE_DECIDING_POINT,
  },
};

/** The format a match in this event and round starts with. */
export function formatFor(category: Category, roundName: string): MatchFormat {
  return FORMATS[category][stageOf(roundName)];
}

function deuceRule(format: MatchFormat): string {
  if (format.decidingPointAtDeuce === null) return "Advantage at every deuce";
  if (format.decidingPointAtDeuce === 1) return "Every deuce: one deciding point";
  return "2nd deuce: one deciding point";
}

/** For the umpire, e.g. "One set to 6 · Tiebreak at 6–all · 2nd deuce: one deciding point". */
export function formatSummary(format: MatchFormat): string {
  const sets =
    format.setsToWin === 1
      ? `One set to ${format.gamesPerSet}`
      : `Best of ${format.setsToWin * 2 - 1} sets to ${format.gamesPerSet}`;
  const decider = format.decidingSet === "matchTiebreak" ? ["Deciding set: tiebreak to 10"] : [];
  return [sets, `Tiebreak at ${format.tiebreakAt}–all`, ...decider, deuceRule(format)].join(" · ");
}

function isFormat(value: unknown): value is MatchFormat {
  if (typeof value !== "object" || value === null) return false;
  const fields = value as Record<string, unknown>;
  const whole = (key: string, min: number) =>
    typeof fields[key] === "number" && Number.isInteger(fields[key]) && (fields[key] as number) >= min;
  return (
    whole("setsToWin", 1) &&
    whole("gamesPerSet", 1) &&
    whole("tiebreakAt", 1) &&
    whole("tiebreakPoints", 1) &&
    (fields.decidingSet === "set" || fields.decidingSet === "matchTiebreak") &&
    (fields.decidingPointAtDeuce === null || whole("decidingPointAtDeuce", 1))
  );
}

/** Checks untrusted input, such as a score record from a phone, as a match format. */
export function parseMatchFormat(value: unknown): MatchFormat {
  if (!isFormat(value)) throw new Error(`Unknown match format ${JSON.stringify(value)}.`);
  return {
    setsToWin: value.setsToWin,
    gamesPerSet: value.gamesPerSet,
    tiebreakAt: value.tiebreakAt,
    tiebreakPoints: value.tiebreakPoints,
    decidingSet: value.decidingSet,
    decidingPointAtDeuce: value.decidingPointAtDeuce,
  };
}

export function sameFormat(a: MatchFormat, b: MatchFormat): boolean {
  return (
    a.setsToWin === b.setsToWin &&
    a.gamesPerSet === b.gamesPerSet &&
    a.tiebreakAt === b.tiebreakAt &&
    a.tiebreakPoints === b.tiebreakPoints &&
    a.decidingSet === b.decidingSet &&
    a.decidingPointAtDeuce === b.decidingPointAtDeuce
  );
}
