// @vitest-environment node
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";

import { getDrawWithSlots, saveGeneratedDraw, saveSeeds, setDrawStatus } from "@/db/draws";
import * as schema from "@/db/schema";
import { SEED_TOURNAMENT } from "@/db/seed";
import type { DrawLine } from "@/lib/draws";

const TOURNAMENT_ID = "tournament-1";

function setup() {
  const database = drizzle(new Database(":memory:"), { schema });
  migrate(database, { migrationsFolder: "./drizzle" });
  database.insert(schema.tournaments).values({ id: TOURNAMENT_ID, ...SEED_TOURNAMENT }).run();

  const players = [
    { id: "a", status: "paid" as const, seed: null },
    { id: "b", status: "confirmed" as const, seed: null },
    { id: "c", status: "cancelled" as const, seed: 2 },
  ];
  for (const player of players) {
    database.insert(schema.users).values({ id: `user-${player.id}`, email: `${player.id}@example.com` }).run();
    database
      .insert(schema.entries)
      .values({
        id: player.id,
        userId: `user-${player.id}`,
        tournamentId: TOURNAMENT_ID,
        category: "MS",
        status: player.status,
        seed: player.seed,
      })
      .run();
  }
  return database;
}

function lines(order: readonly (string | null)[]): DrawLine[] {
  return order.map((entryId, index) => ({ position: index + 1, entryId, seed: null }));
}

function seedOf(database: ReturnType<typeof setup>, entryId: string): number | null {
  return database.select().from(schema.entries).where(eq(schema.entries.id, entryId)).get()!.seed;
}

describe("saveGeneratedDraw", () => {
  it("creates a draft draw with one slot per line", () => {
    const database = setup();
    saveGeneratedDraw(database, { tournamentId: TOURNAMENT_ID, category: "MS", lines: lines(["a", null, "b", null]) });

    const saved = getDrawWithSlots(database, TOURNAMENT_ID, "MS");
    expect(saved?.draw).toMatchObject({ status: "draft", size: 4, publishedAt: null });
    expect(saved?.slots.map((slot) => [slot.position, slot.entryId])).toEqual([
      [1, "a"],
      [2, null],
      [3, "b"],
      [4, null],
    ]);
  });

  it("replaces the lines of a draft draw instead of adding to them", () => {
    const database = setup();
    const firstId = saveGeneratedDraw(database, { tournamentId: TOURNAMENT_ID, category: "MS", lines: lines(["a", "b"]) });
    const secondId = saveGeneratedDraw(database, { tournamentId: TOURNAMENT_ID, category: "MS", lines: lines(["b", "a"]) });

    expect(secondId).toBe(firstId);
    const saved = getDrawWithSlots(database, TOURNAMENT_ID, "MS");
    expect(saved?.slots.map((slot) => slot.entryId)).toEqual(["b", "a"]);
    expect(database.select().from(schema.draws).all()).toHaveLength(1);
  });

  it("refuses a published draw and keeps its lines", () => {
    const database = setup();
    const drawId = saveGeneratedDraw(database, { tournamentId: TOURNAMENT_ID, category: "MS", lines: lines(["a", "b"]) });
    setDrawStatus(database, drawId, "draft", "published");

    expect(() =>
      saveGeneratedDraw(database, { tournamentId: TOURNAMENT_ID, category: "MS", lines: lines(["b", "a"]) }),
    ).toThrow(/published/);
    expect(getDrawWithSlots(database, TOURNAMENT_ID, "MS")?.slots.map((slot) => slot.entryId)).toEqual(["a", "b"]);
  });
});

describe("setDrawStatus", () => {
  it("publishes a draft and records when", () => {
    const database = setup();
    const drawId = saveGeneratedDraw(database, { tournamentId: TOURNAMENT_ID, category: "MS", lines: lines(["a", "b"]) });

    setDrawStatus(database, drawId, "draft", "published");

    const draw = getDrawWithSlots(database, TOURNAMENT_ID, "MS")?.draw;
    expect(draw?.status).toBe("published");
    expect(draw?.publishedAt).toEqual(expect.any(Number));
  });

  it("throws when the draw is not in the expected status", () => {
    const database = setup();
    const drawId = saveGeneratedDraw(database, { tournamentId: TOURNAMENT_ID, category: "MS", lines: lines(["a", "b"]) });

    expect(() => setDrawStatus(database, drawId, "published", "draft")).toThrow(/is not published/);
  });
});

describe("saveSeeds", () => {
  it("seeds accepted entries and clears every other seed in the event", () => {
    const database = setup();

    saveSeeds(database, TOURNAMENT_ID, "MS", [
      { entryId: "a", seed: 1 },
      { entryId: "b", seed: null },
    ]);

    expect(["a", "b", "c"].map((id) => seedOf(database, id))).toEqual([1, null, null]);
  });

  it("rolls back when an entry is not accepted", () => {
    const database = setup();

    expect(() =>
      saveSeeds(database, TOURNAMENT_ID, "MS", [
        { entryId: "a", seed: 1 },
        { entryId: "c", seed: 2 },
      ]),
    ).toThrow("Entry c is not an accepted MS entry.");
    expect(["a", "b", "c"].map((id) => seedOf(database, id))).toEqual([null, null, 2]);
  });
});
