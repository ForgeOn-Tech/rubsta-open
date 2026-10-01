import { describe, expect, it } from "vitest";

import {
  countVotes,
  currentSetNumber,
  leaderboard,
  predictionsOpen,
  setWinners,
  tally,
  type PredictionOutcome,
} from "@/lib/fan-predictions";
import { deriveState, standardFormat, type MatchEvent, type Side } from "@/lib/match";

const POINTS_PER_GAME = 4;

/** Events where `side` wins `games` games in a row from the start of a set. */
function gamesWonBy(side: Side, games: number): MatchEvent[] {
  return Array.from({ length: games * POINTS_PER_GAME }, () => ({ type: "point", side }) as const);
}

function stateAfter(events: readonly MatchEvent[]) {
  return deriveState(events, standardFormat("set"), "top");
}

describe("currentSetNumber and predictionsOpen", () => {
  it("counts the set being played and keeps predictions open early in it", () => {
    const state = stateAfter(gamesWonBy("top", 4));

    expect(currentSetNumber(state)).toBe(1);
    expect(predictionsOpen(state)).toBe(true);
  });

  it("closes predictions once a side reaches five games", () => {
    expect(predictionsOpen(stateAfter(gamesWonBy("top", 5)))).toBe(false);
  });

  it("moves to the next set once one is won, and closes on a completed match", () => {
    const twoSets = [...gamesWonBy("top", 6), ...gamesWonBy("top", 6)];

    expect(currentSetNumber(stateAfter(gamesWonBy("top", 6)))).toBe(2);
    expect(stateAfter(twoSets).status).toBe("completed");
    expect(predictionsOpen(stateAfter(twoSets))).toBe(false);
  });
});

describe("tally", () => {
  it("turns votes into whole percentages that add up", () => {
    expect(tally({ top: 5, bottom: 2 })).toEqual({
      votes: { top: 5, bottom: 2 },
      share: { top: 71, bottom: 29 },
      total: 7,
    });
  });

  it("shows nothing when nobody has voted", () => {
    expect(tally({ top: 0, bottom: 0 })).toEqual({
      votes: { top: 0, bottom: 0 },
      share: { top: 0, bottom: 0 },
      total: 0,
    });
  });

  it("counts a list of picks", () => {
    expect(countVotes(["top", "bottom", "top"])).toEqual({ top: 2, bottom: 1 });
  });
});

describe("setWinners", () => {
  it("names the winner of each completed set", () => {
    const state = stateAfter([...gamesWonBy("top", 6), ...gamesWonBy("bottom", 6)]);

    expect(setWinners(state)).toEqual(
      new Map([
        [1, "top"],
        [2, "bottom"],
      ]),
    );
  });

  it("leaves out the set being played, so an abandoned set scores nothing", () => {
    const state = stateAfter([...gamesWonBy("top", 6), ...gamesWonBy("bottom", 3)]);

    expect(setWinners(state)).toEqual(new Map([[1, "top"]]));
  });
});

describe("leaderboard", () => {
  const outcomes: PredictionOutcome[] = [
    { userId: "rhea", name: "Rhea S.", side: "top", winner: "top" },
    { userId: "rhea", name: "Rhea S.", side: "bottom", winner: "bottom" },
    { userId: "arjun", name: "Arjun K.", side: "top", winner: "bottom" },
    { userId: "arjun", name: "Arjun K.", side: "top", winner: "top" },
    { userId: "meera", name: "Meera V.", side: "top", winner: null },
  ];

  it("gives a point for each correct set and sorts by points", () => {
    expect(leaderboard(outcomes)).toEqual([
      { userId: "rhea", name: "Rhea S.", points: 2, correct: 2, decided: 2 },
      { userId: "arjun", name: "Arjun K.", points: 1, correct: 1, decided: 2 },
    ]);
  });

  it("leaves out a fan whose sets are all still being played", () => {
    expect(leaderboard([outcomes[4]])).toEqual([]);
  });

  it("orders fans on the same points by name", () => {
    const tied: PredictionOutcome[] = [
      { userId: "b", name: "Zara P.", side: "top", winner: "top" },
      { userId: "a", name: "Anil T.", side: "top", winner: "top" },
    ];

    expect(leaderboard(tied).map((score) => score.name)).toEqual(["Anil T.", "Zara P."]);
  });
});
