// @vitest-environment node
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { SEED_TOURNAMENT } from "@/db/seed";
import {
  activeLinkByToken,
  createUmpireLink,
  isActiveUmpireEmail,
  listActiveUmpireEmails,
  listUmpireLinks,
  revokeUmpireLink,
  umpireLinkAccount,
} from "@/db/umpire-links";

const TOURNAMENT_ID = "tournament-1";
const LAST_DAY = "2026-10-25";
const DURING = "2026-10-24";

function setup() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const database = drizzle(sqlite, { schema });
  migrate(database, { migrationsFolder: "./drizzle" });
  database.insert(schema.tournaments).values({ id: TOURNAMENT_ID, ...SEED_TOURNAMENT, endsOn: LAST_DAY }).run();
  return database;
}

function addRavi(database: ReturnType<typeof setup>, now: number) {
  return createUmpireLink(database, { tournamentId: TOURNAMENT_ID, name: "Ravi Kumar", createdBy: "Admin@Example.com", now });
}

describe("umpire links", () => {
  it("creates a link with its own account named after the umpire", () => {
    // Arrange
    const database = setup();

    // Act
    const link = addRavi(database, 1);

    // Assert
    expect(link).toMatchObject({ name: "Ravi Kumar", createdBy: "admin@example.com", revokedAt: null });
    expect(umpireLinkAccount(database, link)).toMatchObject({ email: link.email, name: "Ravi Kumar" });
    expect(activeLinkByToken(database, link.token, DURING)?.id).toBe(link.id);
    expect(isActiveUmpireEmail(database, link.email.toUpperCase(), DURING)).toBe(true);
    expect(listActiveUmpireEmails(database, DURING)).toEqual([link.email]);
  });

  it("gives every umpire a different link and account", () => {
    const database = setup();
    const first = addRavi(database, 1);
    const second = addRavi(database, 2);

    expect(second.token).not.toBe(first.token);
    expect(second.email).not.toBe(first.email);
    expect(listUmpireLinks(database, TOURNAMENT_ID).map((link) => link.id)).toEqual([second.id, first.id]);
  });

  it("stops a revoked link and its account at once, and keeps the first revocation time", () => {
    const database = setup();
    const link = addRavi(database, 1);

    revokeUmpireLink(database, link.id, 10);
    revokeUmpireLink(database, link.id, 20);

    expect(activeLinkByToken(database, link.token, DURING)).toBeNull();
    expect(isActiveUmpireEmail(database, link.email, DURING)).toBe(false);
    expect(listActiveUmpireEmails(database, DURING)).toEqual([]);
    expect(database.select().from(schema.umpireLinks).where(eq(schema.umpireLinks.id, link.id)).get()?.revokedAt).toBe(10);
  });

  it("lapses the day after the tournament ends", () => {
    const database = setup();
    const link = addRavi(database, 1);

    expect(activeLinkByToken(database, link.token, LAST_DAY)).not.toBeNull();
    expect(activeLinkByToken(database, link.token, "2026-10-26")).toBeNull();
  });

  it("knows nothing of an unknown secret or email", () => {
    const database = setup();
    addRavi(database, 1);

    expect(activeLinkByToken(database, "not-a-token", DURING)).toBeNull();
    expect(isActiveUmpireEmail(database, "someone@example.com", DURING)).toBe(false);
    expect(() => revokeUmpireLink(database, "missing", 1)).toThrow(/does not exist/);
  });
});
