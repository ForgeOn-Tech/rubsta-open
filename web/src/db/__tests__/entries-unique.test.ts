// @vitest-environment node
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { SEED_TOURNAMENT } from "@/db/seed";
import { isUniqueViolation } from "@/lib/entries";

const MIGRATIONS_FOLDER = "./drizzle";

function migratedDb() {
  const database = drizzle(new Database(":memory:"), { schema });
  migrate(database, { migrationsFolder: MIGRATIONS_FOLDER });
  return database;
}

function captureError(run: () => void): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("Expected the insert to throw.");
}

describe("entries unique index", () => {
  it("raises an error isUniqueViolation recognises on a second entry in one event", () => {
    const database = migratedDb();
    database.insert(schema.users).values({ id: "user-1", email: "player@example.com" }).run();
    database.insert(schema.tournaments).values({ id: "tournament-1", ...SEED_TOURNAMENT }).run();
    const entry = { userId: "user-1", tournamentId: "tournament-1", category: "MS" as const };
    database.insert(schema.entries).values(entry).run();

    const error = captureError(() => database.insert(schema.entries).values(entry).run());

    expect(isUniqueViolation(error)).toBe(true);
  });

  it("does not treat a missing tournament as a unique violation", () => {
    const database = migratedDb();
    database.insert(schema.users).values({ id: "user-1", email: "player@example.com" }).run();

    const error = captureError(() =>
      database
        .insert(schema.entries)
        .values({ userId: "user-1", tournamentId: "missing", category: "MS" })
        .run(),
    );

    expect(isUniqueViolation(error)).toBe(false);
  });
});
