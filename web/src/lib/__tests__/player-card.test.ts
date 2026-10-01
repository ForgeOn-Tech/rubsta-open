import { describe, expect, it } from "vitest";

import type { Match } from "@/db/schema";
import { formatPlayerId, matchRecord } from "@/lib/player-card";

const STARTED_AT = Date.parse("2026-09-25T05:30:00Z");

const BASE: Match = {
  id: "m",
  drawId: "d",
  matchNumber: 1,
  roundIndex: 0,
  roundName: "Semi-finals",
  topSlot: { kind: "entry", entryId: "mine" },
  bottomSlot: { kind: "entry", entryId: "theirs" },
  events: [{ type: "point", side: "top" }],
  decidingSet: "set",
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
