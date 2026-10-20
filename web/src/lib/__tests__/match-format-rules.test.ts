import { describe, expect, it } from "vitest";

import { deriveState, hasGamePoint, isDecidingPoint, type MatchEvent, type Side } from "@/lib/match";
import {
  BEST_OF_THREE,
  BEST_OF_THREE_DECIDING_POINT,
  EIGHT_GAMES,
  ONE_SET,
  ONE_SET_DECIDING_POINT,
} from "@/lib/match-formats";

function points(side: Side, count: number): MatchEvent[] {
  return Array.from({ length: count }, () => ({ type: "point", side }) as const);
}

/** Games won to love, alternating top then bottom, until the score reaches `top`–`bottom`. */
function gamesTo(top: number, bottom: number): MatchEvent[] {
  const events: MatchEvent[] = [];
  for (let index = 0; index < Math.max(top, bottom); index++) {
    if (index < top) events.push(...points("top", 4));
    if (index < bottom) events.push(...points("bottom", 4));
  }
  return events;
}

/** A game taken to `deuces` deuces: three points each, then a point each per further deuce. */
function toDeuce(deuces: number): MatchEvent[] {
  const events = [...points("top", 3), ...points("bottom", 3)];
  for (let index = 1; index < deuces; index++) events.push(...points("top", 1), ...points("bottom", 1));
  return events;
}

describe("one full set", () => {
  it("ends the match 7–6 on a tiebreak to 7 at 6–all", () => {
    // Arrange
    const sixAll = gamesTo(6, 6);

    // Act
    const atSixAll = deriveState(sixAll, ONE_SET, "top");
    const done = deriveState([...sixAll, ...points("top", 7)], ONE_SET, "top");

    // Assert
    expect(atSixAll.tiebreak).toBe(true);
    expect(atSixAll.tiebreakTarget).toBe(7);
    expect(done.status).toBe("completed");
    expect(done.sets).toEqual([{ games: { top: 7, bottom: 6 }, tiebreak: { top: 7, bottom: 0 }, matchTiebreak: false }]);
  });

  it("ends the match at 6–4 and plays 5–all on to 7–5", () => {
    expect(deriveState(gamesTo(6, 4), ONE_SET, "top").winner).toBe("top");
    const fiveAll = gamesTo(5, 5);
    expect(deriveState([...fiveAll, ...points("top", 4)], ONE_SET, "top").status).toBe("in_progress");
    expect(deriveState([...fiveAll, ...points("top", 8)], ONE_SET, "top").sets[0].games).toEqual({ top: 7, bottom: 5 });
  });

  it("never opens with a match tiebreak", () => {
    expect(deriveState([], ONE_SET, "top").tiebreak).toBe(false);
  });
});

describe("eight games", () => {
  it("ends at 8–6 without a tiebreak", () => {
    const state = deriveState(gamesTo(8, 6), EIGHT_GAMES, "top");
    expect(state.winner).toBe("top");
    expect(state.sets[0].tiebreak).toBeNull();
  });

  it("plays on at 6–all and goes to a tiebreak to 7 at 7–all, ending 8–7", () => {
    expect(deriveState(gamesTo(6, 6), EIGHT_GAMES, "top").tiebreak).toBe(false);

    const sevenAll = deriveState(gamesTo(7, 7), EIGHT_GAMES, "top");
    expect(sevenAll.tiebreak).toBe(true);
    expect(sevenAll.tiebreakTarget).toBe(7);

    const done = deriveState([...gamesTo(7, 7), ...points("bottom", 7)], EIGHT_GAMES, "top");
    expect(done.winner).toBe("bottom");
    expect(done.sets[0].games).toEqual({ top: 7, bottom: 8 });
  });
});

describe("best of three with a super tiebreak", () => {
  it("plays a tiebreak to 10 at one set all", () => {
    const setAll = [...gamesTo(4, 6), ...gamesTo(6, 6), ...points("top", 7)];

    const state = deriveState(setAll, BEST_OF_THREE, "top");
    expect(state.tiebreak).toBe(true);
    expect(state.tiebreakTarget).toBe(10);

    const done = deriveState([...setAll, ...points("bottom", 10)], BEST_OF_THREE, "top");
    expect(done.winner).toBe("bottom");
    expect(done.sets[2]).toEqual({ games: { top: 0, bottom: 1 }, tiebreak: { top: 0, bottom: 10 }, matchTiebreak: true });
  });
});

describe("deciding points", () => {
  it("settles every deuce with one point when the first deuce decides", () => {
    const deuce = deriveState(toDeuce(1), ONE_SET_DECIDING_POINT, "top");
    expect(isDecidingPoint(deuce, ONE_SET_DECIDING_POINT)).toBe(true);
    expect(hasGamePoint(deuce, "top", ONE_SET_DECIDING_POINT)).toBe(true);
    expect(hasGamePoint(deuce, "bottom", ONE_SET_DECIDING_POINT)).toBe(true);

    const after = deriveState([...toDeuce(1), ...points("bottom", 1)], ONE_SET_DECIDING_POINT, "top");
    expect(after.games).toEqual({ top: 0, bottom: 1 });
  });

  it("plays the first deuce out and settles the second with one point", () => {
    const first = deriveState(toDeuce(1), ONE_SET, "top");
    expect(isDecidingPoint(first, ONE_SET)).toBe(false);
    const advantage = deriveState([...toDeuce(1), ...points("top", 1)], ONE_SET, "top");
    expect(advantage.games).toEqual({ top: 0, bottom: 0 });

    const second = deriveState(toDeuce(2), ONE_SET, "top");
    expect(isDecidingPoint(second, ONE_SET)).toBe(true);
    const after = deriveState([...toDeuce(2), ...points("top", 1)], ONE_SET, "top");
    expect(after.games).toEqual({ top: 1, bottom: 0 });
  });

  it("still wins a game by two before any deuce", () => {
    expect(deriveState(points("top", 4), ONE_SET_DECIDING_POINT, "top").games).toEqual({ top: 1, bottom: 0 });
  });

  it("keeps each format's own deuce rule", () => {
    const deuce = deriveState(toDeuce(1), BEST_OF_THREE_DECIDING_POINT, "top");
    expect(isDecidingPoint(deuce, BEST_OF_THREE_DECIDING_POINT)).toBe(true);
    expect(isDecidingPoint(deriveState(toDeuce(1), EIGHT_GAMES, "top"), EIGHT_GAMES)).toBe(false);
  });

  it("is never a deciding point inside a tiebreak", () => {
    const tiebreakAtThreeAll = deriveState([...gamesTo(6, 6), ...points("top", 3), ...points("bottom", 3)], ONE_SET_DECIDING_POINT, "top");
    expect(isDecidingPoint(tiebreakAtThreeAll, ONE_SET_DECIDING_POINT)).toBe(false);
  });
});
