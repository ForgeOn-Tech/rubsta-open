// @vitest-environment node
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";

import { listEntryPlayers } from "@/db/partners";
import * as schema from "@/db/schema";
import { SEED_TOURNAMENT } from "@/db/seed";

const TOURNAMENT_ID = "tournament-1";

function setup() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const database = drizzle(sqlite, { schema });
  migrate(database, { migrationsFolder: "./drizzle" });
  database.insert(schema.tournaments).values({ id: TOURNAMENT_ID, ...SEED_TOURNAMENT }).run();
  for (const [id, fullName] of [["arjun", "Arjun Mehta"], ["sid", "Siddharth Rane"], ["meera", "Meera Iyer"]] as const) {
    database.insert(schema.users).values({ id, email: `${id}@example.com`, name: null }).run();
    database.insert(schema.profiles).values({ userId: id, fullName, dateOfBirth: "1995-01-01", gender: "male", mobile: "1" }).run();
  }
  return database;
}

describe("listEntryPlayers", () => {
  it("lists the player, and a partner only once they have accepted", () => {
    // Arrange
    const database = setup();
    database.insert(schema.entries).values([
      { id: "singles", userId: "arjun", tournamentId: TOURNAMENT_ID, category: "OS", status: "paid" },
      {
        id: "accepted", userId: "arjun", tournamentId: TOURNAMENT_ID, category: "OD", status: "paid",
        partnerName: "Sid", partnerEmail: "sid@example.com", partnerStatus: "accepted", partnerUserId: "sid",
      },
      {
        id: "pending", userId: "meera", tournamentId: TOURNAMENT_ID, category: "D40", status: "paid",
        partnerName: "Sid", partnerEmail: "sid@example.com", partnerStatus: "pending", partnerUserId: null,
      },
      { id: "cancelled", userId: "meera", tournamentId: TOURNAMENT_ID, category: "W30", status: "cancelled" },
    ]).run();

    // Act
    const players = listEntryPlayers(database, TOURNAMENT_ID);

    // Assert
    expect(players.get("singles")).toEqual([{ userId: "arjun", name: "Arjun Mehta" }]);
    expect(players.get("accepted")).toEqual([
      { userId: "arjun", name: "Arjun Mehta" },
      { userId: "sid", name: "Siddharth Rane" },
    ]);
    expect(players.get("pending")).toEqual([{ userId: "meera", name: "Meera Iyer" }]);
    expect(players.has("cancelled")).toBe(false);
  });

  it("is empty for a tournament with no entries", () => {
    expect(listEntryPlayers(setup(), TOURNAMENT_ID).size).toBe(0);
  });
});
