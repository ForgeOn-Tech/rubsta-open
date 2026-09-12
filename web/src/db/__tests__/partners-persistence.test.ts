// @vitest-environment node
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";

import {
  PartnerRejectedError,
  changePartner,
  getPartnerInvitation,
  isInPublishedDraw,
  listPartneredEntries,
  listPendingInvitations,
  listPlayedCategories,
  listTeamEntryIds,
  respondToInvitation,
} from "@/db/partners";
import * as schema from "@/db/schema";
import { SEED_TOURNAMENT } from "@/db/seed";

const TOURNAMENT_ID = "tournament-1";
const INVITER = { userId: "inviter", email: "inviter@example.com" };
const PARTNER = { userId: "partner", email: "partner@example.com" };

/** Two players with profiles, and the inviter's men's doubles entry naming the partner. */
function setup() {
  const sqlite = new Database(":memory:");
  // As in db/client.ts, so deleting an account clears it from entries it joined.
  sqlite.pragma("foreign_keys = ON");
  const database = drizzle(sqlite, { schema });
  migrate(database, { migrationsFolder: "./drizzle" });
  database.insert(schema.tournaments).values({ id: TOURNAMENT_ID, ...SEED_TOURNAMENT }).run();

  for (const [player, fullName] of [
    [INVITER, "Riya Singh"],
    [PARTNER, "Meera Iyer"],
  ] as const) {
    database.insert(schema.users).values({ id: player.userId, email: player.email, name: null }).run();
    database
      .insert(schema.profiles)
      .values({ userId: player.userId, fullName, dateOfBirth: "1995-01-01", gender: "female", mobile: "1" })
      .run();
  }
  database
    .insert(schema.entries)
    .values({
      id: "doubles",
      userId: INVITER.userId,
      tournamentId: TOURNAMENT_ID,
      category: "MD",
      partnerName: "Meera",
      partnerEmail: PARTNER.email,
      partnerStatus: "pending",
      status: "paid",
    })
    .run();
  return database;
}

type Db = ReturnType<typeof setup>;

function entry(database: Db): schema.Entry {
  return database.select().from(schema.entries).where(eq(schema.entries.id, "doubles")).get()!;
}

describe("partner invitations", () => {
  it("names the player who made the entry", () => {
    const database = setup();

    expect(getPartnerInvitation(database, "doubles")?.inviterName).toBe("Riya Singh");
    expect(getPartnerInvitation(database, "missing")).toBeNull();
  });

  it("lists pending invitations for the partner's email, whatever its case", () => {
    const database = setup();

    expect(listPendingInvitations(database, " Partner@Example.com ").map((item) => item.entry.id)).toEqual([
      "doubles",
    ]);
    expect(listPendingInvitations(database, INVITER.email)).toEqual([]);
  });

  it("leaves out invitations on cancelled entries", () => {
    const database = setup();
    database.update(schema.entries).set({ status: "cancelled" }).run();

    expect(listPendingInvitations(database, PARTNER.email)).toEqual([]);
  });
});

describe("respondToInvitation", () => {
  it("joins the partner to the entry under their profile name", () => {
    const database = setup();

    respondToInvitation(database, "doubles", PARTNER, "accept");

    expect(entry(database)).toMatchObject({
      partnerStatus: "accepted",
      partnerUserId: PARTNER.userId,
      partnerName: "Meera Iyer",
    });
    expect(entry(database).partnerRespondedAt).not.toBeNull();
    expect(listPartneredEntries(database, PARTNER.userId).map((item) => item.entry.id)).toEqual(["doubles"]);
    expect(listPlayedCategories(database, PARTNER.userId)).toEqual(["MD"]);
    expect(listTeamEntryIds(database, PARTNER.userId)).toEqual(["doubles"]);
    expect(listTeamEntryIds(database, INVITER.userId)).toEqual(["doubles"]);
    expect(listPendingInvitations(database, PARTNER.email)).toEqual([]);
  });

  it("records a decline without joining the partner", () => {
    const database = setup();

    respondToInvitation(database, "doubles", PARTNER, "decline");

    expect(entry(database)).toMatchObject({ partnerStatus: "declined", partnerUserId: null, partnerName: "Meera" });
    expect(listPlayedCategories(database, PARTNER.userId)).toEqual([]);
  });

  it("refuses a second answer", () => {
    const database = setup();
    respondToInvitation(database, "doubles", PARTNER, "decline");

    expect(() => respondToInvitation(database, "doubles", PARTNER, "accept")).toThrow(PartnerRejectedError);
  });

  it("refuses to accept an event the partner already entered", () => {
    const database = setup();
    database
      .insert(schema.entries)
      .values({ userId: PARTNER.userId, tournamentId: TOURNAMENT_ID, category: "MD", partnerStatus: "pending" })
      .run();

    expect(() => respondToInvitation(database, "doubles", PARTNER, "accept")).toThrow(
      "You already play Men's doubles, so you cannot accept.",
    );
  });

  it("clears the partner's account from the entry when that account is deleted", () => {
    const database = setup();
    respondToInvitation(database, "doubles", PARTNER, "accept");

    database.delete(schema.users).where(eq(schema.users.id, PARTNER.userId)).run();

    expect(entry(database).partnerUserId).toBeNull();
  });
});

describe("changePartner", () => {
  it("names a new partner after a decline, and waits for them", () => {
    const database = setup();
    respondToInvitation(database, "doubles", PARTNER, "decline");

    changePartner(database, "doubles", INVITER, { name: " Asha Rao ", email: "Asha@Example.com" });

    expect(entry(database)).toMatchObject({
      partnerName: "Asha Rao",
      partnerEmail: "asha@example.com",
      partnerStatus: "pending",
      partnerUserId: null,
      partnerRespondedAt: null,
    });
  });

  it("refuses another player's entry", () => {
    const database = setup();

    expect(() => changePartner(database, "doubles", PARTNER, { name: "X", email: "x@example.com" })).toThrow(
      /does not belong/,
    );
  });

  it("refuses an entry in a published draw", () => {
    const database = setup();
    database.insert(schema.draws).values({ id: "draw", tournamentId: TOURNAMENT_ID, category: "MD", size: 2 }).run();
    database.insert(schema.drawSlots).values({ drawId: "draw", position: 1, entryId: "doubles" }).run();

    expect(isInPublishedDraw(database, "doubles")).toBe(false);
    database.update(schema.draws).set({ status: "published" }).run();

    expect(isInPublishedDraw(database, "doubles")).toBe(true);
    expect(() => changePartner(database, "doubles", INVITER, { name: "X", email: "x@example.com" })).toThrow(
      PartnerRejectedError,
    );
  });
});
