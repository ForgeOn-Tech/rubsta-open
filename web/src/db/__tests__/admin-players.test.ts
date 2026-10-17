// @vitest-environment node
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";

import { getAdminPlayer } from "@/db/admin-players";
import * as schema from "@/db/schema";
import { SEED_TOURNAMENT } from "@/db/seed";

const TOURNAMENT_ID = "tournament-1";

function setup() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const database = drizzle(sqlite, { schema });
  migrate(database, { migrationsFolder: "./drizzle" });
  database.insert(schema.tournaments).values({ id: TOURNAMENT_ID, ...SEED_TOURNAMENT }).run();
  for (const [id, fullName] of [["arjun", "Arjun Mehta"], ["meera", "Meera Iyer"]] as const) {
    database.insert(schema.users).values({ id, email: `${id}@example.com`, name: null }).run();
    database.insert(schema.profiles).values({ userId: id, fullName, dateOfBirth: "1995-01-01", gender: "male", mobile: "1" }).run();
  }
  database.insert(schema.users).values({ id: "sid", email: "sid@example.com", name: "Sid R" }).run();
  return database;
}

describe("getAdminPlayer", () => {
  it("lists the player's own entries, cancelled ones too, and doubles they joined as partner", () => {
    // Arrange
    const database = setup();
    database.insert(schema.entries).values([
      { id: "singles", userId: "sid", tournamentId: TOURNAMENT_ID, category: "OS", status: "cancelled", createdAt: 1 },
      {
        id: "joined", userId: "arjun", tournamentId: TOURNAMENT_ID, category: "OD", status: "paid", createdAt: 2,
        partnerName: "Sid", partnerEmail: "sid@example.com", partnerStatus: "accepted", partnerUserId: "sid",
      },
      {
        id: "invited", userId: "meera", tournamentId: TOURNAMENT_ID, category: "D40", status: "paid", createdAt: 3,
        partnerName: "Sid", partnerEmail: "sid@example.com", partnerStatus: "pending", partnerUserId: "sid",
      },
      {
        id: "own-doubles", userId: "sid", tournamentId: TOURNAMENT_ID, category: "D40", status: "paid", createdAt: 4,
        partnerName: "Guest", partnerEmail: "guest@example.com", partnerStatus: "pending", partnerUserId: null,
      },
    ]).run();

    // Act
    const player = getAdminPlayer(database, "sid", TOURNAMENT_ID);

    // Assert
    expect(player?.accountName).toBe("Sid R");
    expect(player?.profile).toBeNull();
    expect(player?.entries.map(({ entry, role, teammate }) => [entry.id, role, teammate])).toEqual([
      ["own-doubles", "player", { userId: null, name: "Guest" }],
      ["joined", "partner", { userId: "arjun", name: "Arjun Mehta" }],
      ["singles", "player", null],
    ]);
  });

  it("returns no entries for a player who has not entered", () => {
    expect(getAdminPlayer(setup(), "meera", TOURNAMENT_ID)?.entries).toEqual([]);
  });

  it("returns null for an unknown user", () => {
    expect(getAdminPlayer(setup(), "nobody", TOURNAMENT_ID)).toBeNull();
  });
});
