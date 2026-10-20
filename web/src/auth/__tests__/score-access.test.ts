// @vitest-environment node
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";
import { SEED_TOURNAMENT } from "@/db/seed";
import { createUmpireLink } from "@/db/umpire-links";
import type { ScheduleEntry } from "@/lib/schedule";

const mocks = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db/client", () => ({ getDb: () => mocks.db }));
vi.mock("../auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { canScoreMatch, scoresOnlyAssignedMatches } from "../require";

const TOURNAMENT_ID = "tournament-1";
const DAY = "2026-10-24";
const NOW = Date.parse("2026-10-24T04:00:00Z");

function matchItem(matchId: string, umpireEmail: string | null): ScheduleEntry {
  return {
    id: `item-${matchId}`, day: DAY, courtNumber: 1, position: 1, kind: "match", matchId,
    title: null, note: null, timing: "at", time: "09:00", endTime: null, umpireEmail,
  };
}

function setup(items: (email: string) => ScheduleEntry[]) {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const database = drizzle(sqlite, { schema });
  migrate(database, { migrationsFolder: "./drizzle" });
  database.insert(schema.tournaments).values({ id: TOURNAMENT_ID, ...SEED_TOURNAMENT, endsOn: "2026-10-25" }).run();
  const link = createUmpireLink(database, { tournamentId: TOURNAMENT_ID, name: "Ravi", createdBy: "admin@example.com", now: NOW });
  database.insert(schema.scheduleDays).values({ tournamentId: TOURNAMENT_ID, day: DAY, publishedAt: NOW, items: items(link.email) }).run();
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

describe("canScoreMatch", () => {
  it("lets a scoring link score only the matches assigned to it", () => {
    // Arrange
    const { link } = setup((email) => [matchItem("mine", email), matchItem("other", "someone@example.com"), matchItem("open", null)]);

    // Act and assert
    expect(canScoreMatch(link.email, "mine")).toBe(true);
    expect(canScoreMatch(link.email, "other")).toBe(false);
    expect(canScoreMatch(link.email, "open")).toBe(false);
    expect(canScoreMatch(link.email, "not-on-the-order-of-play")).toBe(false);
  });

  it("lets admins and listed umpires score any match", () => {
    setup(() => [matchItem("open", null)]);
    expect(canScoreMatch("admin@example.com", "open")).toBe(true);
    expect(canScoreMatch("Staff@Example.com", "unplaced")).toBe(true);
  });

  it("refuses a revoked link even on its own match", () => {
    // Arrange
    const { database, link } = setup((email) => [matchItem("mine", email)]);
    database.update(schema.umpireLinks).set({ revokedAt: NOW }).run();

    // Act and assert
    expect(canScoreMatch(link.email, "mine")).toBe(false);
  });
});

describe("scoresOnlyAssignedMatches", () => {
  it("is true only for scorers outside ADMIN_EMAILS and UMPIRE_EMAILS", () => {
    expect(scoresOnlyAssignedMatches("umpire-x@rubstaopen.invalid")).toBe(true);
    expect(scoresOnlyAssignedMatches("admin@example.com")).toBe(false);
    expect(scoresOnlyAssignedMatches("staff@example.com")).toBe(false);
  });
});
