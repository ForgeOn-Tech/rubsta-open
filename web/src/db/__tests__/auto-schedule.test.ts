// @vitest-environment node
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";

import { applyFill, listFillRounds, previewFill } from "@/db/auto-schedule";
import { addCourt } from "@/db/courts";
import { getDrawWithSlots, saveGeneratedGroups } from "@/db/draws";
import { publishDraw } from "@/db/matches";
import { addMatchItem, listScheduleItems } from "@/db/schedule";
import * as schema from "@/db/schema";
import { SEED_TOURNAMENT } from "@/db/seed";
import { DEFAULT_MATCH_LENGTHS, minutesOf, type FillRequest } from "@/lib/auto-schedule";
import { generateGroups, groupPlan } from "@/lib/groups";

const TOURNAMENT_ID = "tournament-1";
const DAY = "2026-10-24";

/** 16 Open singles players in 4 groups of 4, and two courts. */
function setup() {
  const database = drizzle(new Database(":memory:"), { schema });
  migrate(database, { migrationsFolder: "./drizzle" });
  database.insert(schema.tournaments).values({ id: TOURNAMENT_ID, ...SEED_TOURNAMENT, startsOn: DAY, endsOn: DAY }).run();
  for (let index = 1; index <= 16; index++) {
    database.insert(schema.users).values({ id: `user-${index}`, email: `p${index}@example.com`, name: `P${index}` }).run();
    database
      .insert(schema.entries)
      .values({ id: `e${index}`, userId: `user-${index}`, tournamentId: TOURNAMENT_ID, category: "OS", status: "paid", seed: index <= 4 ? index : null })
      .run();
  }
  const entrants = Array.from({ length: 16 }, (_unused, index) => ({ entryId: `e${index + 1}`, seed: index < 4 ? index + 1 : null }));
  saveGeneratedGroups(database, { tournamentId: TOURNAMENT_ID, category: "OS", qualifiersPerGroup: 2, lines: generateGroups(entrants, groupPlan("OS", 16)!, Math.random) });
  const current = getDrawWithSlots(database, TOURNAMENT_ID, "OS")!;
  publishDraw(database, current.draw, current.slots);
  addCourt(database, TOURNAMENT_ID, { name: null, surface: null, streamUrl: null });
  addCourt(database, TOURNAMENT_ID, { name: null, surface: null, streamUrl: null });
  return database;
}

function request(rounds: string[]): FillRequest {
  return { day: DAY, courts: [1, 2], startTime: "08:00", restMinutes: 30, lengths: DEFAULT_MATCH_LENGTHS, rounds };
}

const GROUPS = ["OS|Group A", "OS|Group B", "OS|Group C", "OS|Group D"];

describe("filling a day", () => {
  it("offers each round still to place, groups first", () => {
    const rounds = listFillRounds(setup(), TOURNAMENT_ID);

    expect(rounds.map((round) => [round.key, round.matchCount])).toEqual([
      ["OS|Group A", 6],
      ["OS|Group B", 6],
      ["OS|Group C", 6],
      ["OS|Group D", 6],
      ["OS|Quarter-finals", 4],
      ["OS|Semi-finals", 2],
      ["OS|Final", 1],
    ]);
  });

  it("places every group match with no player on two courts at once, and rest between their matches", () => {
    // Arrange
    const database = setup();
    const matches = database.select().from(schema.matches).all();
    const playersOf = (matchId: string): string[] => {
      const match = matches.find((row) => row.id === matchId)!;
      return [match.topSlot, match.bottomSlot].flatMap((slot) => (slot.kind === "entry" ? [slot.entryId] : []));
    };

    // Act
    const preview = previewFill(database, TOURNAMENT_ID, request(GROUPS));

    // Assert
    expect(preview.placed).toHaveLength(24);
    expect(preview.unplaced).toEqual([]);
    expect(Math.min(...preview.placed.map((row) => minutesOf(row.start)))).toBe(minutesOf("08:00"));
    for (const court of [1, 2]) {
      const onCourt = preview.placed.filter((row) => row.courtNumber === court).sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
      onCourt.slice(1).forEach((row, index) => expect(minutesOf(row.start)).toBeGreaterThanOrEqual(minutesOf(onCourt[index].end)));
    }
    const players = new Set(preview.placed.flatMap((row) => playersOf(row.matchId)));
    for (const player of players) {
      const theirs = preview.placed
        .filter((row) => playersOf(row.matchId).includes(player))
        .sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
      expect(theirs).toHaveLength(3);
      theirs.slice(1).forEach((row, index) => expect(minutesOf(row.start)).toBeGreaterThanOrEqual(minutesOf(theirs[index].end) + 30));
    }
  });

  it("keeps the knockout until after its groups, and leaves out rounds whose matches have no place", () => {
    const database = setup();

    const quartersAlone = previewFill(database, TOURNAMENT_ID, request(["OS|Quarter-finals"]));
    expect(quartersAlone.placed).toEqual([]);
    expect(quartersAlone.unplaced).toHaveLength(4);
    expect(quartersAlone.unplaced[0].reason).toMatch(/waits on M\d+, which has no earlier place/);

    const withGroups = previewFill(database, TOURNAMENT_ID, request([...GROUPS, "OS|Quarter-finals"]));
    const lastGroupEnd = Math.max(...withGroups.placed.filter((row) => row.label.includes("Group")).map((row) => minutesOf(row.end)));
    const firstQuarter = Math.min(...withGroups.placed.filter((row) => row.label.includes("Quarter")).map((row) => minutesOf(row.start)));
    expect(withGroups.unplaced).toEqual([]);
    // A quarter-final waits for both groups that feed it; with groups interleaved, that is near the end.
    expect(firstQuarter).toBeGreaterThan(minutesOf("08:00"));
    expect(firstQuarter).toBeLessThanOrEqual(lastGroupEnd + 30);
  });

  it("adds the fill after what a court already has, with times the umpires can read", () => {
    // Arrange: one group A match already on court 1 at 09:00.
    const database = setup();
    const first = database.select().from(schema.matches).where(eq(schema.matches.matchNumber, 1)).get()!;
    addMatchItem(database, TOURNAMENT_ID, { day: DAY, courtNumber: 1, matchId: first.id, timing: "at", time: "09:00", umpireEmail: null });

    // Act
    const placed = applyFill(database, TOURNAMENT_ID, request(["OS|Group A"]));

    // Assert
    const items = listScheduleItems(database, TOURNAMENT_ID, DAY);
    expect(placed).toBe(5);
    expect(items).toHaveLength(6);
    const court1 = items.filter((item) => item.courtNumber === 1);
    const court2 = items.filter((item) => item.courtNumber === 2);
    expect(court1[0]).toMatchObject({ matchId: first.id, timing: "at", time: "09:00" });
    expect(court2[0]).toMatchObject({ timing: "at", time: "08:00" });
    expect(court1.slice(1).every((item) => item.timing !== "at")).toBe(true);
    // Placed matches are gone from the offer.
    expect(listFillRounds(database, TOURNAMENT_ID).map((round) => round.key)).not.toContain("OS|Group A");
  });
});
