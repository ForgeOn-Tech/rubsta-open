import { describe, expect, it } from "vitest";

import { finalScoreEvents, needsTiebreak, paperScoreText, type PaperSet } from "@/lib/manual-score";
import { deriveState, scoreLine, type MatchFormat } from "@/lib/match";
import { BEST_OF_THREE, EIGHT_GAMES, ONE_SET, ONE_SET_DECIDING_POINT } from "@/lib/match-formats";

function set(top: number, bottom: number, tiebreak: PaperSet["tiebreak"] = null): PaperSet {
  return { top, bottom, tiebreak };
}

/** The score line the rest of the app shows for these events, top side first. */
function replayedLine(sets: PaperSet[], format: MatchFormat): string {
  const check = finalScoreEvents(sets, format);
  if (!check.ok) throw new Error(check.error);
  const state = deriveState(check.events, format, "top");
  return `${state.winner} ${scoreLine(state.sets, "top")}`;
}

describe("finalScoreEvents", () => {
  it("finishes a one-set match with the games written down", () => {
    expect(replayedLine([set(6, 4)], ONE_SET)).toBe(`top ${scoreLine([{ games: { top: 6, bottom: 4 }, tiebreak: null, matchTiebreak: false }], "top")}`);
    expect(replayedLine([set(3, 6)], ONE_SET).startsWith("bottom")).toBe(true);
    expect(replayedLine([set(7, 5)], ONE_SET_DECIDING_POINT).startsWith("top")).toBe(true);
    expect(replayedLine([set(0, 6)], ONE_SET).startsWith("bottom")).toBe(true);
  });

  it("plays a tiebreak at 6–all and keeps its points", () => {
    const check = finalScoreEvents([set(7, 6, { top: 7, bottom: 5 })], ONE_SET);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(deriveState(check.events, ONE_SET, "top").sets[0].tiebreak).toEqual({ top: 7, bottom: 5 });
    expect(finalScoreEvents([set(6, 7, { top: 10, bottom: 12 })], ONE_SET).ok).toBe(true);
  });

  it("handles 8-game sets with a tiebreak at 7–all", () => {
    expect(finalScoreEvents([set(8, 6)], EIGHT_GAMES).ok).toBe(true);
    expect(finalScoreEvents([set(8, 7, { top: 7, bottom: 3 })], EIGHT_GAMES).ok).toBe(true);
    expect(finalScoreEvents([set(9, 7)], EIGHT_GAMES).ok).toBe(false);
    expect(finalScoreEvents([set(6, 4)], EIGHT_GAMES).ok).toBe(false);
  });

  it("handles best of three with a deciding tiebreak to 10", () => {
    const sets = [set(4, 6), set(7, 6, { top: 7, bottom: 3 }), set(10, 8)];
    const check = finalScoreEvents(sets, BEST_OF_THREE);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    const state = deriveState(check.events, BEST_OF_THREE, "top");
    expect(state.winner).toBe("top");
    expect(state.sets[2]).toMatchObject({ matchTiebreak: true, tiebreak: { top: 10, bottom: 8 } });
    expect(finalScoreEvents([set(6, 3), set(6, 2)], BEST_OF_THREE).ok).toBe(true);
  });

  it("refuses a score that cannot finish the match under its rules", () => {
    expect(finalScoreEvents([], ONE_SET)).toEqual({ ok: false, error: "Enter the games for at least one set." });
    expect(finalScoreEvents([set(5, 5)], ONE_SET).ok).toBe(false);
    expect(finalScoreEvents([set(6, 5)], ONE_SET).ok).toBe(false);
    expect(finalScoreEvents([set(7, 6)], ONE_SET).ok).toBe(false);
    expect(finalScoreEvents([set(6, 4), set(6, 2)], ONE_SET).ok).toBe(false);
    expect(finalScoreEvents([set(8, 2)], ONE_SET).ok).toBe(false);
    expect(finalScoreEvents([set(6, 4)], BEST_OF_THREE).ok).toBe(false);
    expect(finalScoreEvents([set(7, 6, { top: 7, bottom: 6 })], ONE_SET).ok).toBe(false);
  });

  it("names the rules when it refuses", () => {
    const check = finalScoreEvents([set(6, 5)], ONE_SET);
    expect(check.ok ? "" : check.error).toContain("One set to 6");
  });
});

describe("needsTiebreak and paperScoreText", () => {
  it("asks for tiebreak points only at the tiebreak score", () => {
    expect(needsTiebreak(7, 6, ONE_SET)).toBe(true);
    expect(needsTiebreak(6, 7, ONE_SET)).toBe(true);
    expect(needsTiebreak(7, 5, ONE_SET)).toBe(false);
    expect(needsTiebreak(8, 7, EIGHT_GAMES)).toBe(true);
  });

  it("writes the score as players read it", () => {
    expect(paperScoreText([set(4, 6), set(7, 6, { top: 7, bottom: 3 }), set(10, 8)], BEST_OF_THREE)).toBe("4–6 7–6(3) [10–8]");
  });
});
