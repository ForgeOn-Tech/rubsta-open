import { describe, expect, it } from "vitest";

import type { ScoringMatchRow } from "@/db/matches";
import type { Match } from "@/db/schema";
import { deriveState, standardFormat, type MatchEvent, type Side } from "@/lib/match";
import {
  formatElapsed,
  groupScoringMatches,
  matchSummary,
  scoringGroupOf,
  setGamesBySide,
  shortRoundName,
  sideLabel,
  situationLabel,
} from "@/lib/scoring-display";

const STARTED_AT = 1_700_000_000_000;
const SIDES = { top: { name: "Asha Anand", seed: 1 }, bottom: { name: "Bela Rao", seed: null } };

function points(side: Side, count: number): MatchEvent[] {
  return Array.from({ length: count }, () => ({ type: "point", side }));
}

const BASE: Match = {
  id: "m1",
  drawId: "d1",
  matchNumber: 2,
  roundIndex: 0,
  roundName: "Semi-finals",
  topSlot: { kind: "entry", entryId: "a" },
  bottomSlot: { kind: "entry", entryId: "b" },
  events: [],
  decidingSet: "set",
  firstServer: null,
  status: "scheduled",
  winnerEntryId: null,
  court: null,
  startedAt: null,
  completedAt: null,
  version: 0,
  createdAt: STARTED_AT,
  updatedAt: STARTED_AT,
};

function row(match: Partial<Match>): ScoringMatchRow {
  return { match: { ...BASE, ...match }, category: "MS", top: null, bottom: null };
}

function started(events: MatchEvent[], status: Match["status"], winnerEntryId: string | null) {
  return row({ firstServer: "top", startedAt: STARTED_AT, events, status, winnerEntryId });
}

describe("shortRoundName", () => {
  it("shortens each round name that draws use", () => {
    expect(shortRoundName("Final")).toBe("Final");
    expect(shortRoundName("Semi-finals")).toBe("SF");
    expect(shortRoundName("Quarter-finals")).toBe("QF");
    expect(shortRoundName("Round of 16")).toBe("R16");
    expect(shortRoundName("Round of 128")).toBe("R128");
  });

  it("rejects a name that draws never use", () => {
    expect(() => shortRoundName("Playoff")).toThrow(/not a round name/);
  });
});

describe("setGamesBySide", () => {
  it("is null before the match starts", () => {
    expect(setGamesBySide(row({}))).toBeNull();
  });

  it("shows finished sets and the current set while the match plays", () => {
    const events = [...points("top", 24), ...points("bottom", 4)];

    expect(setGamesBySide(started(events, "in_progress", null))).toEqual({ top: "6 0", bottom: "0 1" });
  });

  it("shows only the sets once the match is over", () => {
    expect(setGamesBySide(started(points("top", 48), "completed", "a"))).toEqual({
      top: "6 6",
      bottom: "0 0",
    });
  });
});

describe("sideLabel", () => {
  it("joins doubles partners and keeps the seed", () => {
    const info = { entryId: "a", seed: 3, name: "Asha Anand", partnerName: "Bela Rao" };
    expect(sideLabel(info, { kind: "entry", entryId: "a" })).toEqual({
      name: "Asha Anand / Bela Rao",
      seed: 3,
    });
  });

  it("names byes and slots waiting on a winner", () => {
    expect(sideLabel(null, { kind: "bye" }).name).toBe("Bye");
    expect(sideLabel(null, { kind: "winner", matchNumber: 4 }).name).toBe("Winner of M4");
  });

  it("throws when a drawn entry has no player details", () => {
    expect(() => sideLabel(null, { kind: "entry", entryId: "x" })).toThrow(/Entry x/);
  });
});

describe("scoringGroupOf", () => {
  it("sorts matches into the scoring list's groups and leaves out byes", () => {
    expect(scoringGroupOf(row({}))).toBe("ready");
    expect(scoringGroupOf(row({ bottomSlot: { kind: "winner", matchNumber: 1 } }))).toBe("waiting");
    expect(scoringGroupOf(row({ status: "in_progress" }))).toBe("in_progress");
    expect(scoringGroupOf(row({ status: "completed", winnerEntryId: "a" }))).toBe("completed");
    expect(scoringGroupOf(row({ bottomSlot: { kind: "bye" }, status: "completed" }))).toBeNull();
  });

  it("groups rows in their original order", () => {
    const first = row({ id: "one" });
    const second = row({ id: "two" });
    const groups = groupScoringMatches([first, row({ bottomSlot: { kind: "bye" } }), second]);
    expect(groups.ready.map((item) => item.match.id)).toEqual(["one", "two"]);
    expect(groups.completed).toEqual([]);
  });
});

describe("matchSummary", () => {
  it("has nothing for a scheduled match", () => {
    expect(matchSummary(row({}))).toBeNull();
  });

  it("shows completed sets and current games while in progress", () => {
    expect(matchSummary(started([...points("top", 24), ...points("bottom", 4)], "in_progress", null))).toBe(
      "6–0 0–1",
    );
    expect(matchSummary(started([], "in_progress", null))).toBe("0–0");
  });

  it("shows the result from the winner's side", () => {
    const events = [...points("bottom", 24), ...points("bottom", 24)];
    expect(matchSummary(started(events, "completed", "b"))).toBe("6–0 6–0");
  });

  it("marks a retirement and a walkover", () => {
    expect(matchSummary(started(points("top", 24), "completed", "b"))).toBe("0–6 ret.");
    expect(matchSummary(row({ status: "completed", winnerEntryId: "a", startedAt: STARTED_AT }))).toBe(
      "Walkover",
    );
  });
});

describe("situationLabel", () => {
  const FORMAT = standardFormat("set");

  it("names deuce, advantage and a second serve", () => {
    const deuce = deriveState([...points("top", 3), ...points("bottom", 3)], FORMAT, "top");
    expect(situationLabel(deuce, SIDES)).toBe("Deuce");

    const advantage = deriveState([...points("top", 3), ...points("bottom", 4)], FORMAT, "top");
    expect(situationLabel(advantage, SIDES)).toBe("Advantage Bela Rao");

    const fault = deriveState([{ type: "fault" }], FORMAT, "top");
    expect(situationLabel(fault, SIDES)).toBe("Second serve");
    expect(situationLabel(deriveState([], FORMAT, "top"), SIDES)).toBeNull();
  });

  it("names a tiebreak and a match tiebreak", () => {
    const games = (side: Side, count: number) => points(side, count * 4);
    const twelve = [0, 1, 2, 3, 4, 5].flatMap(() => [...games("top", 1), ...games("bottom", 1)]);
    expect(situationLabel(deriveState(twelve, FORMAT, "top"), SIDES)).toBe("Tiebreak");

    const matchTiebreak = standardFormat("matchTiebreak");
    const setsSplit = [...games("top", 6), ...games("bottom", 6)];
    expect(situationLabel(deriveState(setsSplit, matchTiebreak, "top"), SIDES)).toBe("Match tiebreak");
  });
});

describe("formatElapsed", () => {
  it("shows hours and zero-padded minutes, never negative", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(102 * 60_000 + 59_000)).toBe("1:42");
    expect(formatElapsed(-5_000)).toBe("0:00");
  });
});
