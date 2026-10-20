import { describe, expect, it } from "vitest";

import { buildBracketFromSlots, type DrawEntrant } from "@/lib/draws";
import {
  generateGroups,
  groupLetter,
  groupOfRoundName,
  groupPlaceLabel,
  groupPlan,
  groupQualifiers,
  groupRoundName,
  groupStandings,
  hasStarted,
  knockoutSlots,
  roundRobinPairs,
  seedLimit,
  validateGroupPlan,
  type GroupResult,
} from "@/lib/groups";

/** Steps through 0, 0.1, … so every lot is the same each run. */
function fixedRandom(): () => number {
  let value = 0;
  return () => {
    value = (value + 0.37) % 1;
    return value;
  };
}

function entrants(count: number, seeds: number): DrawEntrant[] {
  return Array.from({ length: count }, (_unused, index) => ({
    entryId: `e${index + 1}`,
    seed: index < seeds ? index + 1 : null,
  }));
}

describe("groupPlan", () => {
  it.each([
    ["OS", 8, null],
    ["OS", 9, { groupCount: 4, qualifiersPerGroup: 2 }],
    ["OS", 16, { groupCount: 4, qualifiersPerGroup: 2 }],
    ["OS", 17, { groupCount: 8, qualifiersPerGroup: 1 }],
    ["OS", 24, { groupCount: 8, qualifiersPerGroup: 1 }],
    ["OS", 32, { groupCount: 8, qualifiersPerGroup: 1 }],
    ["S40", 4, null],
    ["S40", 8, { groupCount: 2, qualifiersPerGroup: 2 }],
    ["S40", 9, { groupCount: 4, qualifiersPerGroup: 1 }],
    ["S40", 16, { groupCount: 4, qualifiersPerGroup: 1 }],
    ["W30", 30, null],
    ["OD", 30, null],
  ] as const)("plays %s with %i entrants as %j", (category, count, plan) => {
    expect(groupPlan(category, count)).toEqual(plan);
  });
});

describe("seedLimit", () => {
  it("allows a seed for each group the entrants could fill, and the usual limit for a knockout", () => {
    expect(seedLimit("OS", 40)).toBe(16);
    expect(seedLimit("OS", 24)).toBe(12);
    expect(seedLimit("OS", 16)).toBe(8);
    expect(seedLimit("S40", 9)).toBe(4);
    expect(seedLimit("W30", 16)).toBe(4);
  });
});

describe("validateGroupPlan", () => {
  const base = { groupCount: "4", qualifiersPerGroup: "2", entrantCount: 16, seedCount: 4 };

  it("accepts groups that fill a knockout of 2, 4, 8 or 16", () => {
    expect(validateGroupPlan(base)).toEqual({ ok: true, plan: { groupCount: 4, qualifiersPerGroup: 2 } });
    expect(validateGroupPlan({ ...base, groupCount: "2", seedCount: 2 })).toEqual({ ok: true, plan: { groupCount: 2, qualifiersPerGroup: 2 } });
    expect(validateGroupPlan({ ...base, groupCount: "8", qualifiersPerGroup: "1" })).toMatchObject({ ok: true });
  });

  it.each([
    ["no groups", { groupCount: "0" }, "Groups must be a whole number from 2 to 16."],
    ["one group, which feeds no knockout", { groupCount: "1", seedCount: 1 }, "Groups must be a whole number from 2 to 16."],
    ["a fraction", { groupCount: "2.5" }, "Groups must be a whole number from 2 to 16."],
    ["three through", { qualifiersPerGroup: "3" }, "Choose 1 or 2 to go through from each group."],
    ["a knockout of 6", { groupCount: "3" }, "3 groups with 2 through make 6 knockout places; it must be 2, 4, 8 or 16."],
    ["groups of one", { groupCount: "16", qualifiersPerGroup: "1" }, "16 players cannot fill 16 groups of at least 2."],
    ["more seeds than groups", { groupCount: "2", seedCount: 4 }, "2 groups take at most 2 seeds, one each. Remove the extra seeds first."],
  ] as const)("refuses %s", (_case, change, error) => {
    expect(validateGroupPlan({ ...base, ...change })).toEqual({ ok: false, error });
  });
});

describe("group names", () => {
  it("letters groups from A and reads them back", () => {
    expect(groupLetter(1)).toBe("A");
    expect(groupRoundName(8)).toBe("Group H");
    expect(groupOfRoundName("Group C")).toBe(3);
    expect(groupOfRoundName("Quarter-finals")).toBeNull();
    expect(groupPlaceLabel(2, 1)).toBe("Group B winner");
    expect(groupPlaceLabel(2, 2)).toBe("Group B runner-up");
  });
});

describe("generateGroups", () => {
  it("heads each group with its seed and evens out the rest", () => {
    // Act: 22 entrants, 8 seeded, in 8 groups.
    const lines = generateGroups(entrants(22, 8), { groupCount: 8, qualifiersPerGroup: 1 }, fixedRandom());

    // Assert
    const sizes = Array.from({ length: 8 }, (_unused, index) => lines.filter((line) => line.groupNumber === index + 1).length);
    expect(sizes.sort()).toEqual([2, 2, 3, 3, 3, 3, 3, 3]);
    for (let group = 1; group <= 8; group++) {
      const head = lines.find((line) => line.groupNumber === group);
      expect(head).toMatchObject({ seed: group, entryId: `e${group}` });
    }
    expect(new Set(lines.map((line) => line.entryId)).size).toBe(22);
    expect(lines.map((line) => line.position)).toEqual(Array.from({ length: 22 }, (_unused, index) => index + 1));
  });

  it("refuses a seed beyond the number of groups", () => {
    expect(() => generateGroups(entrants(16, 5), { groupCount: 4, qualifiersPerGroup: 2 }, fixedRandom())).toThrow(
      /at most 4 seeds/,
    );
  });
});

describe("roundRobinPairs", () => {
  it("pairs everyone once, and nobody twice in a round", () => {
    const pairs = roundRobinPairs(["a", "b", "c", "d"]);

    expect(pairs).toHaveLength(6);
    expect(new Set(pairs.map((pair) => [...pair].sort().join("-"))).size).toBe(6);
    for (let round = 0; round < 3; round++) {
      const players = pairs.slice(round * 2, round * 2 + 2).flat();
      expect(new Set(players).size).toBe(4);
    }
  });

  it("gives an odd group a rest each round", () => {
    expect(roundRobinPairs(["a", "b", "c"])).toHaveLength(3);
    expect(roundRobinPairs(["a", "b"])).toEqual([["a", "b"]]);
    expect(roundRobinPairs(["a"])).toEqual([]);
  });
});

describe("knockoutSlots", () => {
  it("puts eight group winners on the seed lines, A against H in the quarter-finals", () => {
    const slots = knockoutSlots({ groupCount: 8, qualifiersPerGroup: 1 });
    const groups = slots.map((slot) => (slot.kind === "group" ? slot.group : 0));

    expect(groups).toEqual([1, 8, 5, 4, 3, 6, 7, 2]);
  });

  it("crosses runners-up so none meets their own group's winner before the final", () => {
    for (const groupCount of [2, 4]) {
      // Arrange
      const slots = knockoutSlots({ groupCount, qualifiersPerGroup: 2 });
      const half = slots.length / 2;
      const lineOf = (group: number, place: number) =>
        slots.findIndex((slot) => slot.kind === "group" && slot.group === group && slot.place === place);

      // Assert: winner and runner-up of each group sit in different halves.
      for (let group = 1; group <= groupCount; group++) {
        expect(lineOf(group, 1) < half).not.toBe(lineOf(group, 2) < half);
      }
    }
  });

  it("starts the knockout as semi-finals for 40+ singles' four group winners", () => {
    const rounds = buildBracketFromSlots(knockoutSlots({ groupCount: 4, qualifiersPerGroup: 1 }), 25);

    expect(rounds.map((round) => round.name)).toEqual(["Semi-finals", "Final"]);
    expect(rounds[0].matches[0]).toEqual({
      number: 25,
      top: { kind: "group", group: 1, place: 1 },
      bottom: { kind: "group", group: 4, place: 1 },
    });
    expect(rounds[1].matches[0]).toMatchObject({ number: 27, top: { kind: "winner", matchNumber: 25 } });
  });
});

function result(top: string, bottom: string, winner: string | null, topGames: number, bottomGames: number): GroupResult {
  return { top, bottom, winner, games: { top: topGames, bottom: bottomGames } };
}

describe("groupStandings", () => {
  it("orders by matches won and leaves the group open until every match is played", () => {
    const standings = groupStandings(["a", "b", "c"], [result("a", "b", "a", 6, 2), result("b", "c", "b", 6, 4)]);

    expect(standings.complete).toBe(false);
    // a and b won one each, and a beat b.
    expect(standings.rows.map((row) => [row.entryId, row.won, row.place])).toEqual([
      ["a", 1, 1],
      ["b", 1, 2],
      ["c", 0, 3],
    ]);
    expect(groupQualifiers(standings, 1)).toEqual([null]);
  });

  it("orders a three-way cycle on wins by games won", () => {
    const standings = groupStandings(
      ["a", "b", "c"],
      [result("a", "b", "b", 3, 6), result("a", "c", "a", 6, 0), result("b", "c", "c", 4, 6)],
    );

    // Everyone won one and beat one of the others, so games won decides: b 10, a 9, c 6.
    expect(standings.rows.map((row) => [row.entryId, row.gamesWon, row.place])).toEqual([
      ["b", 10, 1],
      ["a", 9, 2],
      ["c", 6, 3],
    ]);
  });

  it("uses head to head between two level players before games", () => {
    const standings = groupStandings(
      ["a", "b", "c", "d"],
      [
        result("a", "b", "a", 7, 6),
        result("a", "c", "c", 0, 6),
        result("a", "d", "a", 6, 0),
        result("b", "c", "b", 6, 0),
        result("b", "d", "b", 6, 0),
        result("c", "d", "d", 0, 6),
      ],
    );

    // a and b both won 2; b won more games, but a beat b.
    expect(standings.rows.slice(0, 2).map((row) => [row.entryId, row.won, row.gamesWon])).toEqual([
      ["a", 2, 13],
      ["b", 2, 18],
    ]);
    expect(groupQualifiers(standings, 2)).toEqual(["a", "b"]);
  });

  it("falls to games won in a three-way cycle, then head to head for the two still level", () => {
    const standings = groupStandings(
      ["a", "b", "c", "d"],
      [
        result("a", "b", "a", 6, 4),
        result("b", "c", "b", 6, 4),
        result("c", "a", "c", 6, 3),
        result("a", "d", "a", 6, 0),
        result("b", "d", "b", 6, 1),
        result("c", "d", "c", 6, 1),
      ],
    );

    // a: 6+3+6 = 15, b: 4+6+6 = 16, c: 4+6+6 = 16. b and c level on games; b beat c.
    expect(standings.rows.map((row) => [row.entryId, row.place])).toEqual([
      ["b", 1],
      ["c", 2],
      ["a", 3],
      ["d", 4],
    ]);
    expect(groupQualifiers(standings, 1)).toEqual(["b"]);
  });

  it("leaves a place open when the rules cannot split the players", () => {
    const standings = groupStandings(
      ["a", "b", "c"],
      [result("a", "b", "a", 6, 4), result("b", "c", "b", 6, 4), result("c", "a", "c", 6, 4)],
    );

    expect(standings.complete).toBe(true);
    expect(standings.rows.every((row) => row.place === 1)).toBe(true);
    expect(groupQualifiers(standings, 2)).toEqual([null, null]);
  });

  it("has no places worth showing until a match has a result", () => {
    expect(hasStarted(groupStandings(["a", "b"], [result("a", "b", null, 3, 2)]))).toBe(false);
    expect(hasStarted(groupStandings(["a", "b"], [result("a", "b", "a", 6, 2)]))).toBe(true);
  });

  it("counts a walkover as a win with no games", () => {
    const standings = groupStandings(["a", "b"], [result("a", "b", "b", 0, 0)]);

    expect(standings.rows[0]).toMatchObject({ entryId: "b", won: 1, gamesWon: 0, place: 1 });
    expect(groupQualifiers(standings, 1)).toEqual(["b"]);
  });
});
