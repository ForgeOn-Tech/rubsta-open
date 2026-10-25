// @vitest-environment node
import SQLite from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, expect, it } from "vitest";

import * as schema from "../schema";
import { SEED_TOURNAMENT } from "../seed";
import { findOwnFeedback, listFeedback, saveFeedback } from "../feedback";

let sqlite: SQLite.Database;
let db: ReturnType<typeof drizzle<typeof schema>>;

beforeEach(() => {
  sqlite = new SQLite(":memory:");
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./drizzle" });
  db.insert(schema.tournaments).values({ id: "t", ...SEED_TOURNAMENT }).run();
  for (const id of ["a", "b"]) db.insert(schema.users).values({ id, email: id + "@example.com" }).run();
});
afterEach(() => sqlite.close());

const rated = (overall: number, comment: string | null = null) => ({ ratings: { overall }, comment });

it("keeps one response per player and replaces it on a resend", () => {
  const first = saveFeedback(db, "t", { userId: "a" }, rated(3), 1);
  const second = saveFeedback(db, "t", { userId: "a" }, rated(5, "Better than I said"), 2);
  expect(second).toBe(first);
  expect(listFeedback(db, "t")).toEqual([
    { id: first, fromPlayer: true, ratings: { overall: 5 }, comment: "Better than I said", updatedAt: 2 },
  ]);
});

it("replaces a visitor's response when their browser sends its id again", () => {
  const id = saveFeedback(db, "t", { visitorResponseId: null }, rated(2), 1);
  expect(saveFeedback(db, "t", { visitorResponseId: id }, rated(4), 2)).toBe(id);
  expect(listFeedback(db, "t")).toHaveLength(1);
  expect(findOwnFeedback(db, "t", { visitorResponseId: id })?.ratings).toEqual({ overall: 4 });
});

it("adds a new response for each visitor without a kept id", () => {
  saveFeedback(db, "t", { visitorResponseId: null }, rated(2), 1);
  saveFeedback(db, "t", { visitorResponseId: null }, rated(4), 2);
  saveFeedback(db, "t", { visitorResponseId: "unknown" }, rated(5), 3);
  expect(listFeedback(db, "t").map((row) => row.ratings.overall)).toEqual([5, 4, 2]);
});

it("never lets a visitor id open or change a player's response", () => {
  const playerResponse = saveFeedback(db, "t", { userId: "a" }, rated(1), 1);
  expect(findOwnFeedback(db, "t", { visitorResponseId: playerResponse })).toBeUndefined();
  saveFeedback(db, "t", { visitorResponseId: playerResponse }, rated(5), 2);
  expect(findOwnFeedback(db, "t", { userId: "a" })?.ratings).toEqual({ overall: 1 });
  expect(listFeedback(db, "t")).toHaveLength(2);
});

it("keeps players' responses apart and shows no names", () => {
  saveFeedback(db, "t", { userId: "a" }, rated(4), 1);
  saveFeedback(db, "t", { userId: "b" }, rated(2), 2);
  const rows = listFeedback(db, "t");
  expect(rows).toHaveLength(2);
  expect(rows.every((row) => !("userId" in row))).toBe(true);
});

it("refuses feedback for a tournament that does not exist", () => {
  expect(() => saveFeedback(db, "missing", { userId: "a" }, rated(4), 1)).toThrow("Tournament missing not found");
});
