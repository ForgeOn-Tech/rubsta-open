// @vitest-environment node
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";

import { AdminEntryRejectedError, addAdminEntry } from "@/db/admin-add-entry";
import { listTeamEntryIds } from "@/db/partners";
import * as schema from "@/db/schema";
import { SEED_TOURNAMENT } from "@/db/seed";
import type { AdminEntryInput, Person } from "@/lib/admin-add-entry";
import { MANUAL_PAYMENT_REF } from "@/lib/entry-status";

const TOURNAMENT_ID = "tournament-1";
const NOW = 1_790_000_000_000;
const PLAYER: Person = { fullName: "Arjun Mehta", email: "arjun@example.com", dateOfBirth: "1999-03-14", gender: "male", mobile: "9000000001", club: null };
const PARTNER: Person = { ...PLAYER, fullName: "Rohan Kulkarni", email: "rohan@example.com" };
const SINGLES: AdminEntryInput = { category: "OS", status: "paid", player: PLAYER, partner: null };
const DOUBLES: AdminEntryInput = { category: "OD", status: "confirmed", player: PLAYER, partner: PARTNER };

function setup() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const database = drizzle(sqlite, { schema });
  migrate(database, { migrationsFolder: "./drizzle" });
  database.insert(schema.tournaments).values({ id: TOURNAMENT_ID, ...SEED_TOURNAMENT }).run();
  return database;
}

function entry(database: ReturnType<typeof setup>, id: string) {
  return database.select().from(schema.entries).where(eq(schema.entries.id, id)).get();
}

describe("addAdminEntry", () => {
  it("creates the player's account and profile and a paid singles entry", () => {
    // Arrange
    const database = setup();

    // Act
    const id = addAdminEntry(database, TOURNAMENT_ID, SINGLES, NOW);

    // Assert
    const user = database.select().from(schema.users).where(eq(schema.users.email, PLAYER.email)).get();
    const profile = database.select().from(schema.profiles).where(eq(schema.profiles.userId, user!.id)).get();
    expect(profile).toMatchObject({ fullName: "Arjun Mehta", mobile: "9000000001", playerNumber: 1 });
    expect(entry(database, id)).toMatchObject({ userId: user!.id, category: "OS", status: "paid", paymentRef: MANUAL_PAYMENT_REF, partnerStatus: null });
  });

  it("adds a doubles entry whose partner has accepted, so both play it", () => {
    const database = setup();

    const id = addAdminEntry(database, TOURNAMENT_ID, DOUBLES, NOW);

    const partner = database.select().from(schema.users).where(eq(schema.users.email, PARTNER.email)).get();
    expect(entry(database, id)).toMatchObject({
      status: "confirmed", paymentRef: null, partnerName: "Rohan Kulkarni", partnerEmail: PARTNER.email,
      partnerStatus: "accepted", partnerUserId: partner!.id, partnerRespondedAt: NOW,
    });
    expect(listTeamEntryIds(database, partner!.id)).toEqual([id]);
  });

  it("reuses an existing account and keeps the profile the player wrote", () => {
    const database = setup();
    addAdminEntry(database, TOURNAMENT_ID, SINGLES, NOW);

    addAdminEntry(database, TOURNAMENT_ID, { ...SINGLES, category: "S40", player: { ...PLAYER, fullName: "A. Mehta" } }, NOW);

    expect(database.select().from(schema.users).all()).toHaveLength(1);
    expect(database.select().from(schema.profiles).get()).toMatchObject({ fullName: "Arjun Mehta" });
  });

  it("refuses a player who already plays the event", () => {
    const database = setup();
    addAdminEntry(database, TOURNAMENT_ID, SINGLES, NOW);

    expect(() => addAdminEntry(database, TOURNAMENT_ID, SINGLES, NOW)).toThrow(
      new AdminEntryRejectedError("Arjun Mehta already plays Open singles."),
    );
  });

  it("refuses a partner who already plays the event, and adds nothing", () => {
    const database = setup();
    addAdminEntry(database, TOURNAMENT_ID, { ...DOUBLES, player: { ...PLAYER, email: "other@example.com", fullName: "Other" } }, NOW);
    const before = database.select().from(schema.entries).all().length;

    expect(() => addAdminEntry(database, TOURNAMENT_ID, DOUBLES, NOW)).toThrow(AdminEntryRejectedError);
    expect(database.select().from(schema.entries).all()).toHaveLength(before);
    expect(database.select().from(schema.users).where(eq(schema.users.email, PLAYER.email)).get()).toBeUndefined();
  });
});
