import { describe, expect, it } from "vitest";

import type { Match } from "@/db/schema";
import { eventResultLabel, formatPlayerId, matchRecord } from "@/lib/player-card";

const STARTED_AT = Date.parse("2026-09-25T05:30:00Z");

const BASE: Match = {
  id: "m",
  drawId: "d",
  matchNumber: 1,
  roundIndex: 0,
  roundName: "Semi-finals",
  groupNumber: null,
  topSlot: { kind: "entry", entryId: "mine" },
  bottomSlot: { kind: "entry", entryId: "theirs" },
  events: [{ type: "point", side: "top" }],
  decidingSet: "set",
  format: null,
  firstServer: "top",
  status: "completed",
  winnerEntryId: "mine",
  court: 1,
  startedAt: STARTED_AT,
  completedAt: STARTED_AT,
  version: 1,
  createdAt: STARTED_AT,
  updatedAt: STARTED_AT,
};

function match(overrides: Partial<Match>): Match {
  return { ...BASE, ...overrides };
}

describe("formatPlayerId", () => {
  it("joins the profile's year and the padded player number", () => {
    expect(formatPlayerId(117, Date.parse("2026-03-01T00:00:00Z"))).toBe("FL-2026-0117");
    expect(formatPlayerId(12345, Date.parse("2025-12-31T23:00:00Z"))).toBe("FL-2025-12345");
  });
});

describe("matchRecord", () => {
  const mine = new Set(["mine", "doubles-i-joined"]);

  it("counts completed matches played by any of the entries, won and lost", () => {
    const matches = [
      match({ id: "won" }),
      match({ id: "lost", winnerEntryId: "theirs" }),
      match({ id: "doubles", topSlot: { kind: "entry", entryId: "doubles-i-joined" }, winnerEntryId: "doubles-i-joined" }),
    ];

    expect(matchRecord(matches, mine)).toEqual({ played: 3, won: 2, lost: 1 });
  });

  it("leaves out matches still to finish and other players' matches", () => {
    const matches = [
      match({ status: "in_progress", winnerEntryId: null }),
      match({ status: "scheduled", winnerEntryId: null, firstServer: null, startedAt: null, events: [] }),
      match({ topSlot: { kind: "entry", entryId: "a" }, bottomSlot: { kind: "entry", entryId: "b" }, winnerEntryId: "a" }),
    ];

    expect(matchRecord(matches, mine)).toEqual({ played: 0, won: 0, lost: 0 });
  });

  it("does not count a bye or a walkover as a match played", () => {
    const matches = [
      match({ bottomSlot: { kind: "bye" }, firstServer: null, startedAt: null, events: [] }),
      match({ firstServer: null, events: [], winnerEntryId: "theirs" }),
    ];

    expect(matchRecord(matches, mine)).toEqual({ played: 0, won: 0, lost: 0 });
  });

  it("counts a retirement as a match played", () => {
    expect(matchRecord([match({ winnerEntryId: "theirs" })], new Set(["mine"]))).toEqual({
      played: 1,
      won: 0,
      lost: 1,
    });
  });
});

describe("eventResultLabel", () => {
  const groupMatch = (status: Match["status"], winnerEntryId: string | null): Match => ({
    ...BASE, roundIndex: 0, roundName: "Group A", groupNumber: 1, status, winnerEntryId,
  });
  const quarter = (status: Match["status"], winnerEntryId: string | null): Match => ({
    ...BASE, roundIndex: 1, roundName: "Quarter-finals", status, winnerEntryId,
  });

  it("puts a player out in the group once every group match is played and none took them through", () => {
    const matches = [groupMatch("completed", "mine"), groupMatch("completed", "theirs"), groupMatch("completed", "theirs")];
    expect(eventResultLabel(matches, "mine", false)).toBe("Out in Group A");
  });

  it("takes a group winner through, even with a group match lost", () => {
    const matches = [groupMatch("completed", "theirs"), groupMatch("completed", "mine"), quarter("scheduled", null)];
    expect(eventResultLabel(matches, "mine", false)).toBe("Through from Group A");
  });

  it("follows the knockout once it has started", () => {
    expect(eventResultLabel([groupMatch("completed", "mine"), quarter("completed", "mine")], "mine", false)).toBe("Advanced from Quarter-finals");
    expect(eventResultLabel([groupMatch("completed", "mine"), quarter("completed", "theirs")], "mine", false)).toBe("Reached Quarter-finals");
  });

  it("shows a group under way, and a final lost", () => {
    expect(eventResultLabel([groupMatch("completed", "mine"), groupMatch("scheduled", null)], "mine", false)).toBe("Playing Group A");
    expect(eventResultLabel([groupMatch("in_progress", null)], "mine", false)).toBe("In progress");
    expect(eventResultLabel([{ ...quarter("completed", "theirs"), roundName: "Final" }], "mine", false)).toBe("Runner-up");
  });

  it("waits for a first match, and names the event winner", () => {
    expect(eventResultLabel([], "mine", false)).toBe("Awaiting match");
    expect(eventResultLabel([groupMatch("scheduled", null)], "mine", false)).toBe("Awaiting match");
    expect(eventResultLabel([], "mine", true)).toBe("Winner");
  });
});
