// @vitest-environment node
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";

import { CourtInUseError, addCourt, deleteCourt, listCourts, updateCourt } from "@/db/courts";
import { getDrawWithSlots, saveGeneratedDraw } from "@/db/draws";
import { publishDraw, unpublishDraw } from "@/db/matches";
import {
  ScheduleItemNotFoundError,
  ScheduleRejectedError,
  addBlockItem,
  addMatchItem,
  getPublishedDay,
  listPublishedDays,
  listScheduleDaysInUse,
  listScheduleItems,
  moveItem,
  moveItemToCourt,
  publishDay,
  removeItem,
  updateBlockItem,
  updateMatchItem,
} from "@/db/schedule";
import * as schema from "@/db/schema";
import { SEED_TOURNAMENT } from "@/db/seed";
import { hasUnpublishedChanges, scheduleEntryOf } from "@/lib/schedule";

const TOURNAMENT_ID = "tournament-1";
const DAY = "2026-09-26";
const NEXT_DAY = "2026-09-27";
const BLOCK = { title: "Serve Speed Challenge", note: "Walk-up entry", time: "12:00", endTime: "14:00" };

/**
 * A tournament with a published 4-line draw: M1 is a over a bye (complete),
 * M2 is b against c, and the final M3 waits on M2.
 */
function setup() {
  const sqlite = new Database(":memory:");
  // As in db/client.ts: deleting a match must delete its place on the order of play.
  sqlite.pragma("foreign_keys = ON");
  const database = drizzle(sqlite, { schema });
  migrate(database, { migrationsFolder: "./drizzle" });
  database.insert(schema.tournaments).values({ id: TOURNAMENT_ID, ...SEED_TOURNAMENT }).run();

  for (const id of ["a", "b", "c"]) {
    database.insert(schema.users).values({ id: `user-${id}`, email: `${id}@example.com`, name: id }).run();
    database
      .insert(schema.entries)
      .values({ id, userId: `user-${id}`, tournamentId: TOURNAMENT_ID, category: "OS", status: "paid" })
      .run();
  }
  const drawId = saveGeneratedDraw(database, {
    tournamentId: TOURNAMENT_ID,
    category: "OS",
    lines: ["a", null, "b", "c"].map((entryId, index) => ({ position: index + 1, entryId, seed: null })),
  });
  const current = getDrawWithSlots(database, TOURNAMENT_ID, "OS")!;
  publishDraw(database, current.draw, current.slots);

  const rows = database.select().from(schema.matches).where(eq(schema.matches.drawId, drawId)).all();
  const byNumber = (matchNumber: number) => rows.find((row) => row.matchNumber === matchNumber)!;
  addCourt(database, TOURNAMENT_ID, {
    name: "Centre",
    surface: "Hard",
    streamUrl: "https://youtu.be/dQw4w9WgXcQ",
  });
  addCourt(database, TOURNAMENT_ID, { name: null, surface: null, streamUrl: null });
  return { database, drawId, bye: byNumber(1), semi: byNumber(2), final: byNumber(3) };
}

type Db = ReturnType<typeof setup>["database"];

function placeMatch(database: Db, matchId: string, courtNumber: number) {
  return addMatchItem(database, TOURNAMENT_ID, {
    day: DAY,
    courtNumber,
    matchId,
    timing: "at",
    time: "11:00",
    umpireEmail: null,
  });
}

function placeBlock(database: Db, courtNumber: number) {
  return addBlockItem(database, TOURNAMENT_ID, { day: DAY, courtNumber, block: BLOCK });
}

function order(database: Db, courtNumber: number): [string, number][] {
  return listScheduleItems(database, TOURNAMENT_ID, DAY)
    .filter((item) => item.courtNumber === courtNumber)
    .map((item) => [item.id, item.position]);
}

describe("courts", () => {
  it("numbers courts in the order they are added", () => {
    const { database } = setup();

    expect(listCourts(database, TOURNAMENT_ID).map((court) => [court.number, court.name])).toEqual([
      [1, "Centre"],
      [2, null],
    ]);
  });

  it("renames a court and keeps its number", () => {
    const { database } = setup();

    updateCourt(database, TOURNAMENT_ID, 2, {
      name: "Show court",
      surface: "Clay",
      streamUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });

    expect(listCourts(database, TOURNAMENT_ID)[1]).toMatchObject({
      number: 2,
      name: "Show court",
      surface: "Clay",
      streamUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
  });

  it("clears a stream link", () => {
    const { database } = setup();

    updateCourt(database, TOURNAMENT_ID, 1, { name: "Centre", surface: "Hard", streamUrl: null });

    expect(listCourts(database, TOURNAMENT_ID)[0].streamUrl).toBeNull();
  });

  it("rejects a change to a court that does not exist", () => {
    const { database } = setup();

    expect(() =>
      updateCourt(database, TOURNAMENT_ID, 9, { name: null, surface: null, streamUrl: null }),
    ).toThrow("Court 9 does not exist.");
  });

  it("deletes an unused court", () => {
    const { database } = setup();

    deleteCourt(database, TOURNAMENT_ID, 2);

    expect(listCourts(database, TOURNAMENT_ID).map((court) => court.number)).toEqual([1]);
  });

  it("keeps a court that the working order of play uses", () => {
    const { database, semi } = setup();
    placeMatch(database, semi.id, 2);

    expect(() => deleteCourt(database, TOURNAMENT_ID, 2)).toThrow(CourtInUseError);
  });

  it("keeps a court that only a published day still uses", () => {
    const { database } = setup();
    const block = placeBlock(database, 2);
    publishDay(database, TOURNAMENT_ID, DAY);
    removeItem(database, block.id);

    expect(() => deleteCourt(database, TOURNAMENT_ID, 2)).toThrow(CourtInUseError);
  });
});

describe("addMatchItem", () => {
  it("puts each match at the bottom of its court", () => {
    const { database, semi, final } = setup();

    const first = placeMatch(database, semi.id, 1);
    const second = placeMatch(database, final.id, 1);

    expect(order(database, 1)).toEqual([
      [first.id, 1],
      [second.id, 2],
    ]);
  });

  it("schedules a match that waits on an earlier result", () => {
    const { database, final } = setup();

    expect(placeMatch(database, final.id, 1)).toMatchObject({ kind: "match", matchId: final.id });
  });

  it("refuses a bye", () => {
    const { database, bye } = setup();

    expect(() => placeMatch(database, bye.id, 1)).toThrow("Open singles M1 is a bye, so it needs no court.");
  });

  it("refuses a completed match", () => {
    const { database, semi } = setup();
    database.update(schema.matches).set({ status: "completed" }).where(eq(schema.matches.id, semi.id)).run();

    expect(() => placeMatch(database, semi.id, 1)).toThrow(/already complete/);
  });

  it("refuses a match that already has a place, naming its day", () => {
    const { database, semi } = setup();
    placeMatch(database, semi.id, 1);

    expect(() => placeMatch(database, semi.id, 2)).toThrow(
      /Open singles M2 is already on the order of play for Sat 26 Sept?\./,
    );
  });

  it("refuses a court that does not exist", () => {
    const { database, semi } = setup();

    expect(() => placeMatch(database, semi.id, 7)).toThrow(ScheduleRejectedError);
  });

  it("refuses an unknown match", () => {
    const { database } = setup();

    expect(() => placeMatch(database, "missing", 1)).toThrow(/not in this tournament/);
  });

  it("rejects a day that is not a date", () => {
    const { database, semi } = setup();

    expect(() =>
      addMatchItem(database, TOURNAMENT_ID, {
        day: "26/09/2026",
        courtNumber: 1,
        matchId: semi.id,
        timing: "followOn",
        time: null,
        umpireEmail: null,
      }),
    ).toThrow(/not a YYYY-MM-DD date/);
  });
});

describe("changing items", () => {
  it("stores a session with its time range", () => {
    const { database } = setup();

    expect(placeBlock(database, 1)).toMatchObject({ kind: "block", timing: "at", ...BLOCK, matchId: null });
  });

  it("updates a match's timing and umpire", () => {
    const { database, semi } = setup();
    const item = placeMatch(database, semi.id, 1);

    updateMatchItem(database, item.id, { timing: "followOn", time: null, umpireEmail: "ump@example.com" });

    expect(listScheduleItems(database, TOURNAMENT_ID, DAY)[0]).toMatchObject({
      timing: "followOn",
      time: null,
      umpireEmail: "ump@example.com",
    });
  });

  it("updates a session", () => {
    const { database } = setup();
    const item = placeBlock(database, 1);

    updateBlockItem(database, item.id, { ...BLOCK, title: "Reaction Challenge", endTime: null });

    expect(listScheduleItems(database, TOURNAMENT_ID, DAY)[0]).toMatchObject({
      title: "Reaction Challenge",
      endTime: null,
    });
  });

  it("refuses to change an item as the wrong kind", () => {
    const { database, semi } = setup();
    const match = placeMatch(database, semi.id, 1);
    const block = placeBlock(database, 1);

    expect(() => updateBlockItem(database, match.id, BLOCK)).toThrow(/not a session/);
    expect(() =>
      updateMatchItem(database, block.id, { timing: "at", time: "11:00", umpireEmail: null }),
    ).toThrow(/not a match/);
  });

  it("swaps an item with its neighbour", () => {
    const { database, semi } = setup();
    const match = placeMatch(database, semi.id, 1);
    const block = placeBlock(database, 1);

    moveItem(database, block.id, "up");

    expect(order(database, 1)).toEqual([
      [block.id, 1],
      [match.id, 2],
    ]);
  });

  it("moves an item to the bottom of another court and closes the gap", () => {
    const { database, semi, final } = setup();
    const first = placeMatch(database, semi.id, 1);
    const second = placeMatch(database, final.id, 1);
    const other = placeBlock(database, 2);

    moveItemToCourt(database, first.id, 2);

    expect(order(database, 1)).toEqual([[second.id, 1]]);
    expect(order(database, 2)).toEqual([
      [other.id, 1],
      [first.id, 2],
    ]);
  });

  it("refuses to move an item to a court that does not exist", () => {
    const { database, semi } = setup();
    const item = placeMatch(database, semi.id, 1);

    expect(() => moveItemToCourt(database, item.id, 9)).toThrow(ScheduleRejectedError);
  });

  it("removes an item and closes the gap", () => {
    const { database, semi, final } = setup();
    const first = placeMatch(database, semi.id, 1);
    const second = placeMatch(database, final.id, 1);

    removeItem(database, first.id);

    expect(order(database, 1)).toEqual([[second.id, 1]]);
  });

  it("reports an item that does not exist", () => {
    const { database } = setup();

    expect(() => removeItem(database, "missing")).toThrow(ScheduleItemNotFoundError);
  });

  it("drops a match's place when its draw goes back to draft", () => {
    const { database, drawId, semi } = setup();
    placeMatch(database, semi.id, 1);
    placeBlock(database, 1);

    unpublishDraw(database, drawId);

    expect(listScheduleItems(database, TOURNAMENT_ID, DAY).map((item) => item.kind)).toEqual(["block"]);
  });
});

describe("publishDay", () => {
  it("copies the day for umpires, and later edits wait for the next publish", () => {
    const { database, semi } = setup();
    const item = placeMatch(database, semi.id, 1);

    publishDay(database, TOURNAMENT_ID, DAY);
    updateMatchItem(database, item.id, { timing: "notBefore", time: "15:30", umpireEmail: null });

    expect(getPublishedDay(database, TOURNAMENT_ID, DAY)?.items).toMatchObject([
      { id: item.id, timing: "at", time: "11:00" },
    ]);

    publishDay(database, TOURNAMENT_ID, DAY);

    expect(getPublishedDay(database, TOURNAMENT_ID, DAY)?.items).toMatchObject([
      { id: item.id, timing: "notBefore", time: "15:30" },
    ]);
    expect(listPublishedDays(database, TOURNAMENT_ID)).toHaveLength(1);
  });

  it("has nothing new to publish after an item moves and moves back", () => {
    const { database, semi } = setup();
    placeMatch(database, semi.id, 1);
    const block = placeBlock(database, 1);
    const published = publishDay(database, TOURNAMENT_ID, DAY);

    moveItem(database, block.id, "up");
    const working = () => listScheduleItems(database, TOURNAMENT_ID, DAY).map(scheduleEntryOf);

    expect(hasUnpublishedChanges(working(), published.items)).toBe(true);

    moveItem(database, block.id, "down");

    expect(hasUnpublishedChanges(working(), published.items)).toBe(false);
  });

  it("is null for a day never published", () => {
    const { database } = setup();

    expect(getPublishedDay(database, TOURNAMENT_ID, DAY)).toBeNull();
  });

  it("lists days with working items or a published order of play", () => {
    const { database } = setup();
    addBlockItem(database, TOURNAMENT_ID, { day: NEXT_DAY, courtNumber: 1, block: BLOCK });
    publishDay(database, TOURNAMENT_ID, DAY);

    expect(listScheduleDaysInUse(database, TOURNAMENT_ID)).toEqual([DAY, NEXT_DAY]);
  });
});
