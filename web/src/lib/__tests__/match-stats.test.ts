import { describe, expect, it } from "vitest";

import { standardFormat, type MatchEvent, type Side } from "@/lib/match";
import { matchStats, statRows, statsOfRecord, type SideStats } from "@/lib/match-stats";

const FORMAT = standardFormat("set");
const FAULT: MatchEvent = { type: "fault" };
const DOUBLE_FAULT: MatchEvent = { type: "doubleFault" };
const LET: MatchEvent = { type: "let" };

function point(side: Side): MatchEvent {
  return { type: "point", side };
}

function points(side: Side, total: number): MatchEvent[] {
  return Array.from({ length: total }, () => point(side));
}

/** Twelve games, each won by its server: top serves the odd games, so the set reaches 6–6. */
function holdsToSixAll(): MatchEvent[] {
  return Array.from({ length: 12 }, (_, game) => points(game % 2 === 0 ? "top" : "bottom", 4)).flat();
}

const ZERO: SideStats = {
  pointsWon: 0,
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

describe("matchStats", () => {
  it("is all zero before a point is played", () => {
    expect(matchStats([], FORMAT, "top")).toEqual({ top: ZERO, bottom: ZERO });
  });

  it("splits the server's points into first and second serve", () => {
    const events = [point("top"), FAULT, point("top"), FAULT, point("bottom"), point("bottom")];

    const stats = matchStats(events, FORMAT, "top");

    expect(stats.top).toMatchObject({
      pointsWon: 2,
      servicePoints: 4,
      firstServesIn: 2,
      firstServePointsWon: 1,
      secondServePoints: 2,
      secondServePointsWon: 1,
    });
    expect(stats.bottom).toMatchObject({ pointsWon: 2, servicePoints: 0 });
  });

  it("counts a double fault once, as a lost second serve, with or without a fault first", () => {
    for (const events of [[DOUBLE_FAULT], [FAULT, DOUBLE_FAULT]]) {
      const stats = matchStats(events, FORMAT, "top");

      expect(stats.top).toMatchObject({
        doubleFaults: 1,
        servicePoints: 1,
        firstServesIn: 0,
        secondServePoints: 1,
        secondServePointsWon: 0,
      });
      expect(stats.bottom.pointsWon).toBe(1);
    }
  });

  it("ignores lets", () => {
    expect(matchStats([LET, point("top")], FORMAT, "top").top).toMatchObject({
      servicePoints: 1,
      firstServesIn: 1,
    });
  });

  it("counts a hold and a break, with the break point that won it", () => {
    // Top holds to love, then breaks bottom to love.
    const events = [...points("top", 4), ...points("top", 4)];

    const stats = matchStats(events, FORMAT, "top");

    expect(stats.top).toMatchObject({
      serviceGames: 1,
      serviceGamesHeld: 1,
      breakPoints: 1,
      breakPointsWon: 1,
    });
    expect(stats.bottom).toMatchObject({ serviceGames: 1, serviceGamesHeld: 0, breakPoints: 0 });
  });

  it("counts break points saved from 0–40", () => {
    const events = [...points("bottom", 3), ...points("top", 5)];

    const stats = matchStats(events, FORMAT, "top");

    expect(stats.bottom).toMatchObject({ breakPoints: 3, breakPointsWon: 0 });
    expect(stats.top).toMatchObject({ serviceGames: 1, serviceGamesHeld: 1 });
  });

  it("counts tiebreak points apart from service games, and the longest run of points", () => {
    const events = [...holdsToSixAll(), ...points("top", 7)];

    const stats = matchStats(events, FORMAT, "top");

    expect(stats.top).toMatchObject({
      serviceGames: 6,
      serviceGamesHeld: 6,
      tiebreakPointsWon: 7,
      longestPointRun: 7,
    });
    expect(stats.bottom).toMatchObject({ serviceGames: 6, tiebreakPointsWon: 0, longestPointRun: 4 });
  });
});

describe("statsOfRecord", () => {
  it("replays the record's own format, so a match tiebreak counts as tiebreak points", () => {
    const events = [...points("top", 24), ...points("bottom", 24), ...points("top", 10)];
    const record = { firstServer: "top" as const, court: null, startedAt: 1, events };

    expect(statsOfRecord({ ...record, decidingSet: "matchTiebreak" }).top.tiebreakPointsWon).toBe(10);
    expect(statsOfRecord({ ...record, decidingSet: "set" }).top.tiebreakPointsWon).toBe(0);
  });
});

describe("statRows", () => {
  it("shows counts, percentages and ratios side by side", () => {
    const events = [point("top"), FAULT, point("bottom"), DOUBLE_FAULT, point("top")];

    const rows = statRows(matchStats(events, FORMAT, "top"));

    expect(rows).toEqual([
      { label: "Points won", top: "2", bottom: "2" },
      { label: "First serve in", top: "50%", bottom: "–" },
      { label: "Won on first serve", top: "100%", bottom: "–" },
      { label: "Won on second serve", top: "0%", bottom: "–" },
      { label: "Double faults", top: "1", bottom: "0" },
      { label: "Break points won", top: "0/0", bottom: "0/0" },
      { label: "Service games held", top: "0/0", bottom: "0/0" },
      // Bottom wins the second point and the double fault in a row.
      { label: "Longest run of points", top: "1", bottom: "2" },
    ]);
  });

  it("adds tiebreak points once a tiebreak is played", () => {
    const rows = statRows(matchStats([...holdsToSixAll(), point("bottom")], FORMAT, "top"));

    expect(rows.find((row) => row.label === "Tiebreak points won")).toEqual({
      label: "Tiebreak points won",
      top: "0",
      bottom: "1",
    });
  });
});
