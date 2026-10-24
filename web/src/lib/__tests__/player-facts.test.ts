import { describe, expect, it } from "vitest";

import type { SideStats } from "@/lib/match-stats";
import { standoutFacts } from "@/lib/player-facts";

const BLANK: SideStats = {
  pointsWon: 0,
  detailsRecorded: 0,
  aces: 0,
  winners: 0,
  errors: 0,
  servicePoints: 0,
  firstServesIn: 0,
  firstServePointsWon: 0,
  secondServePoints: 0,
  secondServePointsWon: 0,
  doubleFaults: 0,
  serviceGames: 0,
  serviceGamesHeld: 0,
  breakPoints: 0,
  breakPointsWon: 0,
  tiebreakPointsWon: 0,
  longestPointRun: 0,
};
const side = (numbers: Partial<SideStats>): SideStats => ({ ...BLANK, ...numbers });

describe("standoutFacts", () => {
  it("has nothing to show without point-by-point matches", () => {
    expect(standoutFacts([], [])).toEqual([]);
  });

  it("leaves out numbers that are not good", () => {
    const mine = side({ pointsWon: 20, longestPointRun: 4, breakPointsWon: 1, serviceGames: 6, serviceGamesHeld: 3, servicePoints: 30, firstServesIn: 15, doubleFaults: 3 });
    expect(standoutFacts([mine], [side({ pointsWon: 30 })])).toEqual([]);
  });

  it("adds the matches together and keeps the best three, strongest first", () => {
    const first = side({ pointsWon: 30, longestPointRun: 7, breakPointsWon: 2, aces: 1, serviceGames: 5, serviceGamesHeld: 5 });
    const second = side({ pointsWon: 28, longestPointRun: 5, breakPointsWon: 1, aces: 2, serviceGames: 5, serviceGamesHeld: 4 });

    expect(standoutFacts([first, second], [side({ pointsWon: 20 }), side({ pointsWon: 22 })])).toEqual([
      { value: "7", label: "points in a row" },
      { value: "3", label: "breaks of serve" },
      { value: "3", label: "aces" },
    ]);
  });

  it("shows service and point shares when there are enough points behind them", () => {
    const mine = side({ pointsWon: 40, servicePoints: 30, firstServesIn: 24, serviceGames: 6, serviceGamesHeld: 6 });

    expect(standoutFacts([mine], [side({ pointsWon: 20 })])).toEqual([
      { value: "6/6", label: "service games held" },
      { value: "67%", label: "of points won" },
      { value: "80%", label: "first serves in" },
    ]);
  });
});
