import { describe, expect, it } from "vitest";

import type { Category } from "@/db/schema";
import { standardFormat } from "@/lib/match";
import {
  BEST_OF_THREE,
  BEST_OF_THREE_DECIDING_POINT,
  EIGHT_GAMES,
  ONE_SET,
  ONE_SET_DECIDING_POINT,
  formatFor,
  formatSummary,
  parseMatchFormat,
  sameFormat,
} from "@/lib/match-formats";

const ROUNDS = ["Round of 32", "Round of 16", "Quarter-finals", "Semi-finals", "Final"] as const;

function formatsBy(category: Category) {
  return ROUNDS.map((round) => formatFor(category, round));
}

describe("formatFor", () => {
  it.each(["OS", "U15", "W30"] as const)("plays %s as one set, 8 games in the quarters, then best of 3", (category) => {
    expect(formatsBy(category)).toEqual([ONE_SET, ONE_SET, EIGHT_GAMES, BEST_OF_THREE, BEST_OF_THREE]);
  });

  it("plays 40+ singles as one set, then 8-game semi-finals and final", () => {
    expect(formatsBy("S40")).toEqual([ONE_SET, ONE_SET, ONE_SET, EIGHT_GAMES, EIGHT_GAMES]);
  });

  it("plays 40+ doubles as one set with a deciding point at every deuce", () => {
    expect(formatsBy("D40")).toEqual(ROUNDS.map(() => ONE_SET_DECIDING_POINT));
  });

  it("plays Open doubles the same, except for a best-of-3 final", () => {
    expect(formatsBy("OD")).toEqual([
      ONE_SET_DECIDING_POINT,
      ONE_SET_DECIDING_POINT,
      ONE_SET_DECIDING_POINT,
      ONE_SET_DECIDING_POINT,
      BEST_OF_THREE_DECIDING_POINT,
    ]);
  });

  it("plays a small draw's first round, when it is the quarter-finals, as 8 games", () => {
    expect(formatFor("W30", "Quarter-finals")).toEqual(EIGHT_GAMES);
  });
});

describe("formatSummary", () => {
  it("describes each format for the umpire", () => {
    expect(formatSummary(ONE_SET)).toBe("One set to 6 · Tiebreak at 6–all · 2nd deuce: one deciding point");
    expect(formatSummary(EIGHT_GAMES)).toBe("One set to 8 · Tiebreak at 7–all · 2nd deuce: one deciding point");
    expect(formatSummary(BEST_OF_THREE_DECIDING_POINT)).toBe(
      "Best of 3 sets to 6 · Tiebreak at 6–all · Deciding set: tiebreak to 10 · Every deuce: one deciding point",
    );
    expect(formatSummary(standardFormat("set"))).toBe("Best of 3 sets to 6 · Tiebreak at 6–all · Advantage at every deuce");
  });
});

describe("parseMatchFormat", () => {
  it("reads a format back from JSON", () => {
    expect(parseMatchFormat(JSON.parse(JSON.stringify(EIGHT_GAMES)))).toEqual(EIGHT_GAMES);
  });

  it.each([
    ["nothing", null],
    ["a missing field", { ...ONE_SET, tiebreakAt: undefined }],
    ["no sets", { ...ONE_SET, setsToWin: 0 }],
    ["an unknown deciding set", { ...ONE_SET, decidingSet: "coinToss" }],
    ["a fractional deuce", { ...ONE_SET, decidingPointAtDeuce: 1.5 }],
  ])("refuses %s", (_case, value) => {
    expect(() => parseMatchFormat(value)).toThrow(/Unknown match format/);
  });
});

describe("sameFormat", () => {
  it("compares every rule", () => {
    expect(sameFormat(ONE_SET, { ...ONE_SET })).toBe(true);
    expect(sameFormat(ONE_SET, ONE_SET_DECIDING_POINT)).toBe(false);
  });
});
