// @vitest-environment node
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";

import { applyFill, dependencyWarnings, listFillRounds, listTimedItems, moveItemToSlot, placeMatchAtSlot, previewFill, unscheduleItem } from "@/db/auto-schedule";
import { addCourt } from "@/db/courts";
import { getDrawWithSlots, saveGeneratedGroups } from "@/db/draws";
import { publishDraw } from "@/db/matches";
import { ScheduleRejectedError, addMatchItem, listScheduleItems } from "@/db/schedule";
import * as schema from "@/db/schema";
import { SEED_TOURNAMENT } from "@/db/seed";
import { DEFAULT_MATCH_LENGTHS, clockOf, minutesOf, type FillRequest } from "@/lib/auto-schedule";
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
  return { day: DAY, courts: [1, 2], startTime: "08:00", finishBy: null, restMinutes: 30, lengths: DEFAULT_MATCH_LENGTHS, rounds, eventStarts: {} };
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

  it("keeps the rest and match lengths a fill used, and a preview changes nothing", () => {
    const database = setup();
    const lengths = { oneSet: 40, eightGames: 55, bestOfThree: 80 };
    const saved = () => database.select().from(schema.tournaments).where(eq(schema.tournaments.id, TOURNAMENT_ID)).get()!;

    previewFill(database, TOURNAMENT_ID, { ...request(GROUPS), restMinutes: 20, lengths });
    expect(saved().scheduleRestMinutes).toBeNull();

    applyFill(database, TOURNAMENT_ID, { ...request(GROUPS), restMinutes: 20, lengths });
    expect(saved()).toMatchObject({ scheduleRestMinutes: 20, oneSetMinutes: 40, eightGamesMinutes: 55, bestOfThreeMinutes: 80 });
  });

  it("starts an event no earlier than its own start time", () => {
    const preview = previewFill(setup(), TOURNAMENT_ID, { ...request(GROUPS), eventStarts: { OS: "10:30" } });

    expect(preview.placed).toHaveLength(24);
    expect(Math.min(...preview.placed.map((row) => minutesOf(row.start)))).toBe(minutesOf("10:30"));
  });

  it("lists the matches that would start after the last start as not placed", () => {
    const preview = previewFill(setup(), TOURNAMENT_ID, { ...request(GROUPS), finishBy: "10:00" });

    // Two courts from 08:00 to a last start of 10:00 take three rounds of 45-minute matches each.
    expect(preview.placed).toHaveLength(6);
    expect(preview.unplaced).toHaveLength(18);
    expect(preview.unplaced[0].reason).toBe("It would start after 10:00, the last start.");
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
    // Every match the fill places starts at a time players can read.
    expect(items.every((item) => item.timing === "at" && item.time !== null)).toBe(true);
    // Placed matches are gone from the offer.
    expect(listFillRounds(database, TOURNAMENT_ID).map((round) => round.key)).not.toContain("OS|Group A");
  });
});

describe("moving a match on the grid", () => {
  /** Group A's matches 1–4 placed by hand: court 1 has M1 at 08:00 then M2 following on; court 2 has M3 at 09:00 then M4. */
  function placed() {
    const database = setup();
    const byNumber = (number: number) => database.select().from(schema.matches).where(eq(schema.matches.matchNumber, number)).get()!;
    const place = (number: number, courtNumber: number, timing: "at" | "followOn", time: string | null) =>
      addMatchItem(database, TOURNAMENT_ID, { day: DAY, courtNumber, matchId: byNumber(number).id, timing, time, umpireEmail: null });
    const items = [place(1, 1, "at", "08:00"), place(2, 1, "followOn", null), place(3, 2, "at", "09:00"), place(4, 2, "followOn", null)];
    return { database, byNumber, items };
  }

  function grid(database: ReturnType<typeof setup>, courtNumber: number): [string, string, number, string | null][] {
    return listTimedItems(database, TOURNAMENT_ID, DAY, DEFAULT_MATCH_LENGTHS)
      .filter((row) => row.item.courtNumber === courtNumber)
      .map((row) => [clockOf(row.start), row.item.timing, row.item.position, row.item.matchId]);
  }

  it("puts the match at its new court and time, and moves the court's later matches after it", () => {
    // Arrange
    const { database, byNumber, items } = placed();

    // Act: M2 to court 2 at 09:00, ahead of M3.
    moveItemToSlot(database, items[1].id, { courtNumber: 2, time: "09:00" }, DEFAULT_MATCH_LENGTHS);

    // Assert: M3 was at 09:00, where M2 now plays, so it gets the time M2 should finish.
    expect(grid(database, 2)).toEqual([
      ["09:00", "at", 1, byNumber(2).id],
      ["09:45", "at", 2, byNumber(3).id],
      ["10:30", "followOn", 3, byNumber(4).id],
    ]);
    expect(grid(database, 1)).toEqual([["08:00", "at", 1, byNumber(1).id]]);
  });

  it("goes after a court's matches when dropped later than all of them", () => {
    const { database, byNumber, items } = placed();

    moveItemToSlot(database, items[0].id, { courtNumber: 2, time: "13:00" }, DEFAULT_MATCH_LENGTHS);

    expect(grid(database, 2).map((row) => [row[0], row[3]])).toEqual([
      ["09:00", byNumber(3).id],
      ["09:45", byNumber(4).id],
      ["13:00", byNumber(1).id],
    ]);
  });

  it("gives the court it leaves a new first match at the moved match's start", () => {
    const { database, byNumber, items } = placed();

    moveItemToSlot(database, items[0].id, { courtNumber: 2, time: "13:00" }, DEFAULT_MATCH_LENGTHS);

    expect(grid(database, 1)).toEqual([["08:00", "at", 1, byNumber(2).id]]);
  });

  it("moves a match later on its own court", () => {
    const { database, byNumber, items } = placed();

    moveItemToSlot(database, items[0].id, { courtNumber: 1, time: "11:00" }, DEFAULT_MATCH_LENGTHS);

    expect(grid(database, 1)).toEqual([
      ["08:00", "at", 1, byNumber(2).id],
      ["11:00", "at", 2, byNumber(1).id],
    ]);
  });

  it("leaves a fixed time below alone when the moved match is over before it", () => {
    const { database, byNumber, items } = placed();

    moveItemToSlot(database, items[0].id, { courtNumber: 2, time: "07:00" }, DEFAULT_MATCH_LENGTHS);

    expect(grid(database, 2)).toEqual([
      ["07:00", "at", 1, byNumber(1).id],
      ["09:00", "at", 2, byNumber(3).id],
      ["09:45", "followOn", 3, byNumber(4).id],
    ]);
  });

  it("places a match from the tray at a court and time, ahead of what starts later", () => {
    const { database, byNumber } = placed();

    placeMatchAtSlot(database, TOURNAMENT_ID, { day: DAY, matchId: byNumber(5).id, courtNumber: 2, time: "08:30" }, DEFAULT_MATCH_LENGTHS);

    expect(grid(database, 2)).toEqual([
      ["08:30", "at", 1, byNumber(5).id],
      ["09:15", "at", 2, byNumber(3).id],
      ["10:00", "followOn", 3, byNumber(4).id],
    ]);
  });

  it("refuses to place a match that already has a place", () => {
    const { database, byNumber } = placed();

    expect(() =>
      placeMatchAtSlot(database, TOURNAMENT_ID, { day: DAY, matchId: byNumber(1).id, courtNumber: 2, time: "08:30" }, DEFAULT_MATCH_LENGTHS),
    ).toThrow(ScheduleRejectedError);
    expect(grid(database, 2)).toHaveLength(2);
  });

  it("leaves a match under way where it is", () => {
    const { database, byNumber, items } = placed();
    database.update(schema.matches).set({ status: "in_progress" }).where(eq(schema.matches.id, byNumber(1).id)).run();

    expect(() => moveItemToSlot(database, items[0].id, { courtNumber: 2, time: "13:00" }, DEFAULT_MATCH_LENGTHS)).toThrow(
      new ScheduleRejectedError("M1 has started, so it stays on Court 1."),
    );
    expect(grid(database, 1).map((row) => row[3])).toEqual([byNumber(1).id, byNumber(2).id]);
  });

  it("takes a match back to the tray, but not one under way", () => {
    const { database, byNumber, items } = placed();
    database.update(schema.matches).set({ status: "in_progress" }).where(eq(schema.matches.id, byNumber(3).id)).run();

    unscheduleItem(database, items[1].id);

    expect(grid(database, 1).map((row) => row[3])).toEqual([byNumber(1).id]);
    expect(() => unscheduleItem(database, items[2].id)).toThrow(new ScheduleRejectedError("M3 has started, so it stays on Court 2."));
  });

  it.each([
    ["a court that does not exist", { courtNumber: 9, time: "10:00" }, "Court 9 does not exist. Add it in Settings first."],
    ["a time that is not a time", { courtNumber: 2, time: "25:00" }, "Choose a time such as 10:15."],
  ])("refuses %s", (_case, target, message) => {
    const { database, items } = placed();

    expect(() => moveItemToSlot(database, items[0].id, target, DEFAULT_MATCH_LENGTHS)).toThrow(new ScheduleRejectedError(message));
  });
});

describe("dependencyWarnings", () => {
  const warningsFor = (database: ReturnType<typeof setup>) =>
    dependencyWarnings(database, TOURNAMENT_ID, DAY, listTimedItems(database, TOURNAMENT_ID, DAY, DEFAULT_MATCH_LENGTHS), 30);
  const quarter = (database: ReturnType<typeof setup>) =>
    database.select().from(schema.matches).where(eq(schema.matches.roundName, "Quarter-finals")).all().sort((a, b) => a.matchNumber - b.matchNumber)[0];

  it("warns about a knockout match whose groups have matches with no place", () => {
    const database = setup();
    const first = quarter(database);
    addMatchItem(database, TOURNAMENT_ID, { day: DAY, courtNumber: 1, matchId: first.id, timing: "at", time: "16:00", umpireEmail: null });

    expect(warningsFor(database).get(first.id)).toEqual([
      "Waits on Open singles Group A, which has a match with no place yet",
      "Waits on Open singles Group B, which has a match with no place yet",
    ]);
  });

  it("warns when the groups should still be playing, and is quiet once they are over with rest", () => {
    // Arrange: every group match on the two courts from 08:00.
    const database = setup();
    applyFill(database, TOURNAMENT_ID, request(GROUPS));
    const first = quarter(database);
    const groupsEnd = Math.max(...listTimedItems(database, TOURNAMENT_ID, DAY, DEFAULT_MATCH_LENGTHS).map((row) => row.end));

    // Act: too early, then late enough.
    placeMatchAtSlot(database, TOURNAMENT_ID, { day: DAY, matchId: first.id, courtNumber: 1, time: "09:00" }, DEFAULT_MATCH_LENGTHS);
    const early = warningsFor(database).get(first.id) ?? [];
    const item = listScheduleItems(database, TOURNAMENT_ID, DAY).find((row) => row.matchId === first.id)!;
    moveItemToSlot(database, item.id, { courtNumber: 2, time: clockOf(groupsEnd + 60) }, DEFAULT_MATCH_LENGTHS);

    // Assert
    expect(early).toHaveLength(2);
    expect(early[0]).toMatch(/^Waits on Open singles Group A, which should end \d\d:\d\d$/);
    expect(warningsFor(database).get(first.id)).toBeUndefined();
  });
});
