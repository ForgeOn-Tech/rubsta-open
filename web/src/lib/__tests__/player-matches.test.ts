import { describe, expect, it } from "vitest";

import type { ScoringMatchRow } from "@/db/matches";
import type { Match, MatchSlot } from "@/db/schema";
import { drawRounds, nextMatch, teamMatches, teamSide } from "@/lib/player-matches";
import type { PublishedPlace } from "@/lib/schedule";

const AT = 1_700_000_000_000;
const MINE = new Set(["mine"]);

function entry(entryId: string): MatchSlot {
  return { kind: "entry", entryId };
}

function row(id: string, overrides: Partial<Match>): ScoringMatchRow {
  const match: Match = {
    id,
    drawId: "d",
    matchNumber: 1,
    roundIndex: 0,
    roundName: "Quarter-finals",
    topSlot: entry("mine"),
    bottomSlot: entry("theirs"),
    events: [],
    decidingSet: "set",
    firstServer: null,
    status: "scheduled",
    winnerEntryId: null,
    court: null,
    startedAt: null,
    completedAt: null,
    version: 0,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
  return { match, category: "OS", top: null, bottom: null };
}

function place(day: string, courtNumber: number, position: number): PublishedPlace {
  return { day, courtNumber, position, timing: "11:00", umpireEmail: null };
}

describe("teamSide and teamMatches", () => {
  it("finds the side the player's entry is on", () => {
    expect(teamSide(row("a", {}), MINE)).toBe("top");
    expect(teamSide(row("b", { topSlot: entry("x"), bottomSlot: entry("mine") }), MINE)).toBe("bottom");
    expect(teamSide(row("c", { topSlot: entry("x") }), MINE)).toBeNull();
  });

  it("keeps the player's matches, including one waiting on an opponent, and drops byes", () => {
    const rows = [
      row("played", {}),
      row("waiting", { bottomSlot: { kind: "winner", matchNumber: 3 } }),
      row("bye", { bottomSlot: { kind: "bye" } }),
      row("other", { topSlot: entry("x") }),
    ];

    expect(teamMatches(rows, MINE).map((item) => item.match.id)).toEqual(["played", "waiting"]);
  });
});

describe("nextMatch", () => {
  it("picks a match in play first", () => {
    const rows = [row("scheduled", {}), row("live", { status: "in_progress" })];

    expect(nextMatch(rows, MINE, new Map([["scheduled", place("2026-09-25", 1, 1)]]))?.match.id).toBe("live");
  });

  it("then the earliest place on the published order of play", () => {
    const rows = [row("later", {}), row("court-2", {}), row("unplaced", { roundIndex: 0 })];
    const places = new Map([
      ["later", place("2026-09-26", 1, 1)],
      ["court-2", place("2026-09-25", 2, 1)],
    ]);

    expect(nextMatch(rows, MINE, places)?.match.id).toBe("court-2");
  });

  it("then the earliest round still to play", () => {
    const rows = [
      row("final", { roundIndex: 2, matchNumber: 7 }),
      row("semi", { roundIndex: 1, matchNumber: 5 }),
      row("done", { roundIndex: 0, status: "completed", winnerEntryId: "mine" }),
    ];

    expect(nextMatch(rows, MINE, new Map())?.match.id).toBe("semi");
  });

  it("is null when every match is finished", () => {
    expect(nextMatch([row("done", { status: "completed" })], MINE, new Map())).toBeNull();
  });
});

describe("drawRounds", () => {
  it("groups matches by round in draw order", () => {
    const rows = [
      row("final", { roundIndex: 1, matchNumber: 3, roundName: "Final" }),
      row("m2", { matchNumber: 2 }),
      row("m1", { matchNumber: 1 }),
    ];

    expect(
      drawRounds(rows).map((round) => [round.name, round.rows.map((item) => item.match.id)]),
    ).toEqual([
      ["Quarter-finals", ["m1", "m2"]],
      ["Final", ["final"]],
    ]);
  });

  it("is empty for a draw with no matches", () => {
    expect(drawRounds([])).toEqual([]);
  });
});
