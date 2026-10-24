import { describe, expect, it } from "vitest";

import type { ScoringMatchRow } from "@/db/matches";
import type { EntryPlayer } from "@/db/partners";
import type { Category, Match, MatchSlot } from "@/db/schema";
import { minutesOf } from "@/lib/auto-schedule";
import { busyElsewhereWarnings, sameDayWarnings, timingClashes } from "@/lib/schedule-clashes";

const AT = 1_700_000_000_000;
const ARJUN: EntryPlayer = { userId: "arjun", name: "Arjun Mehta" };
const ROHAN: EntryPlayer = { userId: "rohan", name: "Rohan Kulkarni" };
const KABIR: EntryPlayer = { userId: "kabir", name: "Kabir Shetty" };
const ISHAAN: EntryPlayer = { userId: "ishaan", name: "Ishaan Rao" };
const SIDDHARTH: EntryPlayer = { userId: "siddharth", name: "Siddharth Rane" };

// Arjun plays singles, and Open doubles with Siddharth.
const ENTRY_PLAYERS = new Map<string, EntryPlayer[]>([
  ["os-arjun", [ARJUN]],
  ["os-rohan", [ROHAN]],
  ["od-arjun", [ARJUN, SIDDHARTH]],
  ["od-kabir", [KABIR, ISHAAN]],
  ["od-siddharth-only", [{ userId: "other", name: "Other" }, SIDDHARTH]],
]);

function slot(entryId: string): MatchSlot {
  return { kind: "entry", entryId };
}

function row(id: string, category: Category, matchNumber: number, top: MatchSlot, bottom: MatchSlot, overrides: Partial<Match>): ScoringMatchRow {
  const match: Match = {
    id,
    drawId: "d",
    matchNumber,
    roundIndex: 0,
    roundName: "Semi-finals",
    groupNumber: null,
    topSlot: top,
    bottomSlot: bottom,
    events: [],
    decidingSet: "set",
    manualScore: false,
    format: null,
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
  return { match, category, top: null, bottom: null };
}

const SINGLES = row("singles", "OS", 3, slot("os-arjun"), slot("os-rohan"), {});
const DOUBLES = row("doubles", "OD", 12, slot("od-arjun"), slot("od-kabir"), {});

describe("sameDayWarnings", () => {
  it("names the player in both matches, on each of them", () => {
    // Act
    const warnings = sameDayWarnings(
      [
        { row: SINGLES, place: "Court 1 · 10:00" },
        { row: DOUBLES, place: "Court 2 · 10:00" },
      ],
      ENTRY_PLAYERS,
    );

    // Assert
    expect(warnings.get("singles")).toEqual(["Arjun Mehta also plays Open doubles M12 · Court 2 · 10:00"]);
    expect(warnings.get("doubles")).toEqual(["Arjun Mehta also plays Open singles M3 · Court 1 · 10:00"]);
  });

  it("finds a doubles partner shared by two doubles matches", () => {
    const other = row("other-doubles", "OD", 14, slot("od-siddharth-only"), slot("od-kabir"), {});

    const warnings = sameDayWarnings(
      [
        { row: DOUBLES, place: "Court 2 · 10:00" },
        { row: other, place: "Court 1 · Not before 15:00" },
      ],
      ENTRY_PLAYERS,
    );

    expect(warnings.get("doubles")).toEqual([
      "Siddharth Rane also plays Open doubles M14 · Court 1 · Not before 15:00",
      "Kabir Shetty also plays Open doubles M14 · Court 1 · Not before 15:00",
      "Ishaan Rao also plays Open doubles M14 · Court 1 · Not before 15:00",
    ]);
  });

  it("ignores a match already finished", () => {
    const finished = row("singles", "OS", 3, slot("os-arjun"), slot("os-rohan"), { status: "completed" });

    const warnings = sameDayWarnings(
      [
        { row: finished, place: "Court 1 · 10:00" },
        { row: DOUBLES, place: "Court 2 · 12:00" },
      ],
      ENTRY_PLAYERS,
    );

    expect(warnings.get("doubles")).toEqual([]);
    expect(warnings.has("singles")).toBe(false);
  });

  it("knows nobody in a slot still waiting for a winner", () => {
    const final = row("final", "OS", 7, { kind: "winner", matchNumber: 3 }, slot("os-rohan"), {});

    const warnings = sameDayWarnings(
      [
        { row: final, place: "Court 1 · 16:00" },
        { row: DOUBLES, place: "Court 2 · 10:00" },
      ],
      ENTRY_PLAYERS,
    );

    expect(warnings.get("final")).toEqual([]);
  });
});

describe("busyElsewhereWarnings", () => {
  it("names a player still in a match in progress, and its court", () => {
    const live = row("doubles", "OD", 12, slot("od-arjun"), slot("od-kabir"), { status: "in_progress", court: 2 });

    expect(busyElsewhereWarnings(SINGLES, [SINGLES, live], ENTRY_PLAYERS)).toEqual([
      "Arjun Mehta was still playing Open doubles M12 on Court 2 when this page loaded.",
    ]);
  });

  it("says nothing when the other match has not started or this one is finished", () => {
    const live = row("doubles", "OD", 12, slot("od-arjun"), slot("od-kabir"), { status: "in_progress", court: 2 });
    const finished = row("singles", "OS", 3, slot("os-arjun"), slot("os-rohan"), { status: "completed" });

    expect(busyElsewhereWarnings(SINGLES, [SINGLES, DOUBLES], ENTRY_PLAYERS)).toEqual([]);
    expect(busyElsewhereWarnings(finished, [finished, live], ENTRY_PLAYERS)).toEqual([]);
  });
});

describe("timingClashes", () => {
  const REST = 30;
  const at = (start: string, end: string, courtNumber: number) => ({ courtNumber, start: minutesOf(start), end: minutesOf(end) });

  it("flags a player on two courts at the same time, on both matches", () => {
    const clashes = timingClashes(
      [
        { row: SINGLES, ...at("10:00", "10:45", 1) },
        { row: DOUBLES, ...at("10:30", "11:15", 2) },
      ],
      ENTRY_PLAYERS,
      REST,
    );

    expect(clashes.get("singles")).toEqual(["Arjun Mehta also plays Open doubles M12 on Court 2 at 10:30"]);
    expect(clashes.get("doubles")).toEqual(["Arjun Mehta also plays Open singles M3 on Court 1 at 10:00"]);
  });

  it("flags too little rest between a player's matches", () => {
    const clashes = timingClashes(
      [
        { row: SINGLES, ...at("10:00", "10:45", 1) },
        { row: DOUBLES, ...at("11:00", "11:45", 1) },
      ],
      ENTRY_PLAYERS,
      REST,
    );

    expect(clashes.get("doubles")).toEqual(["Arjun Mehta has 15 min rest after Open singles M3"]);
    expect(clashes.get("singles")).toEqual(["Arjun Mehta has 15 min rest before Open doubles M12"]);
  });

  it("is quiet with enough rest, and leaves out finished matches", () => {
    const finished = row("done", "OS", 4, slot("os-arjun"), slot("os-rohan"), { status: "completed" });
    const clashes = timingClashes(
      [
        { row: SINGLES, ...at("10:00", "10:45", 1) },
        { row: DOUBLES, ...at("11:15", "12:00", 2) },
        { row: finished, ...at("10:00", "10:45", 3) },
      ],
      ENTRY_PLAYERS,
      REST,
    );

    expect([...clashes.values()].flat()).toEqual([]);
  });
});
