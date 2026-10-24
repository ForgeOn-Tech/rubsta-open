// @vitest-environment node
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";
import { SEED_TOURNAMENT } from "@/db/seed";
import { createUmpireLink } from "@/db/umpire-links";

const mocks = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db/client", () => ({ getDb: () => mocks.db }));
vi.mock("../auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { canScoreMatches } from "../require";

const TOURNAMENT_ID = "tournament-1";
const NOW = Date.parse("2026-10-24T04:00:00Z");

/** A tournament with one umpire scoring link. */
function setup() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const database = drizzle(sqlite, { schema });
  migrate(database, { migrationsFolder: "./drizzle" });
  database.insert(schema.tournaments).values({ id: TOURNAMENT_ID, ...SEED_TOURNAMENT, endsOn: "2026-10-25" }).run();
  const link = createUmpireLink(database, { tournamentId: TOURNAMENT_ID, name: "Ravi", createdBy: "admin@example.com", now: NOW });
  mocks.db = database;
  return { database, link };
}

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
  vi.stubEnv("UMPIRE_EMAILS", "staff@example.com");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("canScoreMatches", () => {
  it("lets a working scoring link, admins and listed umpires score", () => {
    // Arrange
    const { link } = setup();

    // Act and assert
    expect(canScoreMatches(link.email)).toBe(true);
    expect(canScoreMatches("admin@example.com")).toBe(true);
    expect(canScoreMatches("Staff@Example.com")).toBe(true);
  });

  it("refuses a removed link and a player", () => {
    // Arrange
    const { database, link } = setup();
    database.update(schema.umpireLinks).set({ revokedAt: NOW }).run();

    // Act and assert
    expect(canScoreMatches(link.email)).toBe(false);
    expect(canScoreMatches("player@example.com")).toBe(false);
  });
});
