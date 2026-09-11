import { describe, expect, it } from "vitest";

import {
  advantageSide,
  applyEvent,
  changeEndsAfterThisGame,
  currentGameNumber,
  deriveState,
  hasGamePoint,
  initialState,
  isDeuce,
  other,
  pointLabel,
  setScores,
  standardFormat,
  type MatchEvent,
  type Side,
} from "@/lib/match";

const FORMAT = standardFormat();

function point(side: Side): MatchEvent {
  return { type: "point", side };
}

/** `count` points for `side`. */
function points(side: Side, count: number): MatchEvent[] {
  return Array.from({ length: count }, () => point(side));
}

/** One game from 0–0: four straight points (no deuce on the way). */
function game(side: Side): MatchEvent[] {
  return points(side, 4);
}

/** Games for each side in order, e.g. set("top", 6, 4). */
function set(side: Side, won: number, lost: number): MatchEvent[] {
  const events: MatchEvent[] = [];
  for (let index = 0; index < Math.max(won, lost); index += 1) {
    if (index < won) events.push(...game(side));
    if (index < lost) events.push(...game(other(side)));
  }
  return events;
}

function straightSetsMatch(side: Side): MatchEvent[] {
  return [...set(side, 6, 0), ...set(side, 6, 0)];
}

describe("initialState", () => {
  it("starts a love-all match with the chosen server", () => {
    const state = initialState("top", FORMAT);
    expect(state).toMatchObject({
      games: { top: 0, bottom: 0 },
      points: { top: 0, bottom: 0 },
      server: "top",
      status: "in_progress",
      winner: null,
      tiebreak: false,
    });
  });

  it("starts with games, not a tiebreak, even in match-tiebreak format", () => {
    const state = initialState("top", standardFormat("matchTiebreak"));
    expect(state.tiebreak).toBe(false);
  });
});

describe("games", () => {
  it("labels points and awards a game at 40", () => {
    let state = initialState("top", FORMAT);
    state = applyEvent(state, point("top"), FORMAT);
    state = applyEvent(state, point("top"), FORMAT);
    state = applyEvent(state, point("bottom"), FORMAT);
    expect(pointLabel(state, "top")).toBe("30");
    expect(pointLabel(state, "bottom")).toBe("15");

    state = applyEvent(state, point("top"), FORMAT);
    expect(pointLabel(state, "top")).toBe("40");
    expect(hasGamePoint(state, "top")).toBe(true);

    state = applyEvent(state, point("top"), FORMAT);
    expect(state.games).toEqual({ top: 1, bottom: 0 });
    expect(state.points).toEqual({ top: 0, bottom: 0 });
    expect(state.server).toBe("bottom");
  });

  it("plays deuce: advantage in, back to deuce, then the game", () => {
    let state = initialState("top", FORMAT);
    state = deriveState([...points("top", 3), ...points("bottom", 3)], FORMAT, "top");
    expect(isDeuce(state)).toBe(true);
    expect(pointLabel(state, "top")).toBe("40");
    expect(pointLabel(state, "bottom")).toBe("40");

    state = applyEvent(state, point("top"), FORMAT);
    expect(isDeuce(state)).toBe(false);
    expect(advantageSide(state)).toBe("top");
    expect(pointLabel(state, "top")).toBe("Ad");
    expect(pointLabel(state, "bottom")).toBe("40");

    state = applyEvent(state, point("bottom"), FORMAT);
    expect(isDeuce(state)).toBe(true);
    expect(advantageSide(state)).toBe(null);

    state = applyEvent(state, point("top"), FORMAT);
    state = applyEvent(state, point("top"), FORMAT);
    expect(state.games).toEqual({ top: 1, bottom: 0 });
  });

  it("alternates the server every game", () => {
    const servers: Side[] = [];
    let state = initialState("top", FORMAT);
    for (let index = 0; index < 3; index += 1) {
      servers.push(state.server);
      for (const event of game(state.server === "top" ? "top" : "bottom")) {
        state = applyEvent(state, event, FORMAT);
      }
    }
    expect(servers).toEqual(["top", "bottom", "top"]);
  });

  it("passes the serve on after a break", () => {
    const state = deriveState(game("bottom"), FORMAT, "top");
    expect(state.games).toEqual({ top: 0, bottom: 1 });
    expect(state.server).toBe("bottom");
  });
});

describe("sets", () => {
  it("records a 6–0 set and starts the next", () => {
    const state = deriveState(set("top", 6, 0), FORMAT, "top");
    expect(state.sets).toEqual([{ games: { top: 6, bottom: 0 }, tiebreak: null }]);
    expect(state.status).toBe("in_progress");
    expect(state.games).toEqual({ top: 0, bottom: 0 });
  });

  it("records a 7–6(5) set with the tiebreak points", () => {
    const events = [
      ...set("top", 6, 6),
      // Interleave so the tiebreak reaches 7–5 rather than ending early.
      ...Array.from({ length: 5 }, () => [...points("top", 1), ...points("bottom", 1)]).flat(),
      ...points("top", 2),
    ];
    const state = deriveState(events, FORMAT, "top");
    expect(state.sets).toEqual([
      { games: { top: 7, bottom: 6 }, tiebreak: { top: 7, bottom: 5 } },
    ]);
    expect(setScores(state)).toEqual({ top: ["7", "0"], bottom: ["6(5)", "0"] });
  });

  it("plays a tiebreak past 6–6 to win by two", () => {
    const events = [...set("top", 6, 6), ...points("top", 6), ...points("bottom", 6)];
    let state = deriveState(events, FORMAT, "top");
    expect(state.tiebreak).toBe(true);
    expect(state.status).toBe("in_progress");

    state = applyEvent(state, point("top"), FORMAT);
    expect(state.status).toBe("in_progress"); // 7–6 is not enough
    state = applyEvent(state, point("bottom"), FORMAT);
    expect(state.status).toBe("in_progress"); // back level
    state = applyEvent(state, point("top"), FORMAT);
    state = applyEvent(state, point("top"), FORMAT);
    expect(state.sets[0]).toEqual({
      games: { top: 7, bottom: 6 },
      tiebreak: { top: 9, bottom: 7 },
    });
  });

  it("gives the tiebreak serve to the side due, and the next set to the other", () => {
    // Every game is a hold, so bottom serves game 12 and top serves the tiebreak.
    let state = deriveState(set("top", 6, 6), FORMAT, "top");
    expect(state.tiebreak).toBe(true);
    expect(state.server).toBe("top");

    state = deriveState([...set("top", 6, 6), ...points("top", 7)], FORMAT, "top");
    expect(state.sets).toHaveLength(1);
    expect(state.server).toBe("bottom");
  });

  it("requires two clear games before 6–6", () => {
    const state = deriveState(set("top", 5, 4), FORMAT, "top");
    expect(state.sets).toEqual([]);
    expect(state.games).toEqual({ top: 5, bottom: 4 });
  });
});

describe("match", () => {
  it("completes a straight-sets match", () => {
    const state = deriveState(straightSetsMatch("top"), FORMAT, "top");
    expect(state.status).toBe("completed");
    expect(state.winner).toBe("top");
    expect(setScores(state)).toEqual({ top: ["6", "6", "0"], bottom: ["0", "0", "0"] });
  });

  it("rejects points after completion", () => {
    const state = deriveState(straightSetsMatch("top"), FORMAT, "top");
    expect(() => applyEvent(state, point("top"), FORMAT)).toThrow(/complete/);
  });

  it("plays a full third set when decidingSet is 'set'", () => {
    const events = [...set("top", 6, 0), ...set("bottom", 6, 0), ...set("top", 6, 4)];
    const state = deriveState(events, FORMAT, "top");
    expect(state.status).toBe("completed");
    expect(state.winner).toBe("top");
    expect(state.sets).toHaveLength(3);
  });

  it("plays a 10-point match tiebreak instead of a third set", () => {
    const format = standardFormat("matchTiebreak");
    let state = deriveState([...set("top", 6, 0), ...set("bottom", 6, 0)], format, "top");
    expect(state.status).toBe("in_progress");
    expect(state.tiebreak).toBe(true);
    expect(state.tiebreakTarget).toBe(10);
    expect(state.games).toEqual({ top: 0, bottom: 0 });

    const tiebreak = [
      ...Array.from({ length: 8 }, () => [...points("top", 1), ...points("bottom", 1)]).flat(),
      ...points("top", 2),
    ];
    state = deriveState([...set("top", 6, 0), ...set("bottom", 6, 0), ...tiebreak], format, "top");
    expect(state.status).toBe("completed");
    expect(state.winner).toBe("top");
    expect(state.sets[2]).toEqual({
      games: { top: 7, bottom: 6 },
      tiebreak: { top: 10, bottom: 8 },
    });
  });
});

describe("serve events", () => {
  it("marks a pending fault and clears it when the rally is played", () => {
    let state = initialState("top", FORMAT);
    state = applyEvent(state, { type: "fault" }, FORMAT);
    expect(state.faultPending).toBe(true);
    state = applyEvent(state, point("top"), FORMAT);
    expect(state.faultPending).toBe(false);
  });

  it("double fault gives the point to the receiver and counts the stat", () => {
    let state = initialState("top", FORMAT);
    state = applyEvent(state, { type: "fault" }, FORMAT);
    state = applyEvent(state, { type: "doubleFault" }, FORMAT);
    expect(state.doubleFaults).toEqual({ top: 1, bottom: 0 });
    expect(state.points).toEqual({ top: 0, bottom: 1 });
    expect(state.server).toBe("top");
  });

  it("let does not change the score", () => {
    const state = deriveState([point("top"), { type: "let" } as MatchEvent], FORMAT, "top");
    expect(state.points).toEqual({ top: 1, bottom: 0 });
  });
});

describe("derived stats", () => {
  it("counts break-point chances and conversions for the receiver", () => {
    // Server top. Bottom reaches 40–0 (chance), top saves to 40–15 (another
    // chance), bottom converts: 2 chances, 1 won.
    const events: MatchEvent[] = [
      ...points("bottom", 3),
      point("top"),
      point("bottom"),
    ];
    const state = deriveState(events, FORMAT, "top");
    expect(state.breakPointChances).toEqual({ top: 0, bottom: 2 });
    expect(state.breakPointsWon).toEqual({ top: 0, bottom: 1 });
  });

  it("credits break points to the receiver after the serve changes on a break", () => {
    // Bottom breaks top in game 1, so top receives game 2 and breaks back.
    const events: MatchEvent[] = [...game("bottom"), ...game("top")];
    const state = deriveState(events, FORMAT, "top");
    expect(state.breakPointChances).toEqual({ top: 1, bottom: 1 });
    expect(state.breakPointsWon).toEqual({ top: 1, bottom: 1 });
  });

  it("does not count break points during a tiebreak", () => {
    const events: MatchEvent[] = [...set("top", 6, 6), ...points("bottom", 3)];
    const state = deriveState(events, FORMAT, "top");
    expect(state.breakPointChances).toEqual({ top: 0, bottom: 0 });
  });
});

describe("undo", () => {
  it("re-deriving without the last event restores the previous state", () => {
    const events = [...set("top", 6, 0), ...points("top", 2), { type: "fault" } as MatchEvent];
    const beforeFault = deriveState(events.slice(0, -1), FORMAT, "top");
    const afterFault = deriveState(events, FORMAT, "top");
    expect(afterFault.faultPending).toBe(true);
    expect(beforeFault.faultPending).toBe(false);
    expect(afterFault.sets).toEqual(beforeFault.sets);
  });
});

describe("display helpers", () => {
  it("tracks the current game number within the set", () => {
    let state = deriveState(set("top", 3, 2), FORMAT, "top");
    expect(currentGameNumber(state)).toBe(6);

    state = deriveState([...set("top", 6, 4), ...set("bottom", 2, 1)], FORMAT, "top");
    expect(currentGameNumber(state)).toBe(4);
  });

  it("flags change of ends after odd-numbered games", () => {
    let state = initialState("top", FORMAT);
    expect(changeEndsAfterThisGame(state)).toBe(true); // game 1
    state = deriveState(game("top"), FORMAT, "top");
    expect(changeEndsAfterThisGame(state)).toBe(false); // game 2
  });
});
