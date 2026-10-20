// @vitest-environment node
import SQLite from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { beforeEach, afterEach, it, expect } from "vitest";
import * as schema from "../schema";
import { SEED_TOURNAMENT } from "../seed";
import { disablePlayerCardShare, enablePlayerCardShare, getPlayerCard, sharedCardOwner } from "../player-cards";
let sqlite: SQLite.Database;
let db: ReturnType<typeof drizzle<typeof schema>>;
beforeEach(() => {
 sqlite = new SQLite(":memory:"); sqlite.pragma("foreign_keys = ON"); db = drizzle(sqlite, { schema }); migrate(db, { migrationsFolder: "./drizzle" });
 db.insert(schema.tournaments).values({ id: "t", ...SEED_TOURNAMENT }).run();
 for (const id of ["a", "b", "partner"]) {
  db.insert(schema.users).values({ id, email: id+"@private.example" }).run();
  if (id !== "b") db.insert(schema.profiles).values({ userId: id, fullName: id === "a" ? "Asha" : "Partner", dateOfBirth: "1990-01-01", gender: "female", mobile: "9876543210", previousTournaments: [{ name: "Earlier Open", year: 2025, result: "Semi-final" }] }).run();
 }
 for (const id of ["a", "b"]) db.insert(schema.entries).values({ id: "entry-"+id, userId: id, tournamentId: "t", category: "OD", status: "confirmed", ...(id === "a" ? { partnerUserId: "partner", partnerName: "Partner", partnerStatus: "accepted" as const } : {}) }).run();
 db.insert(schema.draws).values({ id: "draw", tournamentId: "t", category: "OD", status: "published", size: 2 }).run();
 db.insert(schema.matches).values({ id: "final", drawId: "draw", matchNumber: 1, roundIndex: 0, roundName: "Final", topSlot: { kind: "entry", entryId: "entry-a" }, bottomSlot: { kind: "entry", entryId: "entry-b" }, firstServer: "top", startedAt: 1, completedAt: 2, status: "completed", winnerEntryId: "entry-a", events: Array.from({ length: 48 }, () => ({ type: "point" as const, side: "top" as const })) }).run();
});
afterEach(() => sqlite.close());
it("creates a stable link, revokes it and makes a different one when re-enabled", () => {
 const first = enablePlayerCardShare(db, "a");
 expect(enablePlayerCardShare(db, "a").token).toBe(first.token);
 expect(sharedCardOwner(db, first.token)).toBe("a");
 disablePlayerCardShare(db, "partner"); expect(sharedCardOwner(db, first.token)).toBe("a");
 disablePlayerCardShare(db, "a"); expect(sharedCardOwner(db, first.token)).toBeNull();
 expect(enablePlayerCardShare(db, "a").token).not.toBe(first.token);
 expect(() => enablePlayerCardShare(db, "b")).toThrow("Complete your profile");
});
it("shows verified results and certificates for both accepted doubles players", () => {
 for (const user of ["a", "partner"]) {
  const card = getPlayerCard(db, user)!;
  expect(card.totals).toEqual({ played: 1, won: 1, lost: 0 });
  expect(card.tournaments[0].results).toEqual([{ category: "OD", label: "Winner" }]);
  expect(card.tournaments[0].certificates.map(c => c.kind)).toEqual(["participation", "winner"]);
  expect(card.tournaments[0].history[0]).toMatchObject({ opponent: "Player", result: "Won" });
 }
});
it("omits contact data and does not fall back to an opponent email", () => {
 const serialized = JSON.stringify(getPlayerCard(db, "a"));
 for (const privateText of ["@private.example", "1990-01-01", "9876543210", "userId", "dateOfBirth"]) expect(serialized).not.toContain(privateText);
});
it("hides draft results and certificates", () => {
 db.update(schema.draws).set({ status: "draft" }).where(eq(schema.draws.id, "draw")).run();
 const card = getPlayerCard(db, "a")!;
 expect(card.totals.played).toBe(0);
 expect(card.tournaments[0].history).toEqual([]);
 expect(card.tournaments[0].certificates).toEqual([]);
});
it("does not count walkovers as played matches", () => {
 db.update(schema.matches).set({ events: [], firstServer: null, startedAt: null }).run();
 const card = getPlayerCard(db, "a")!;
 expect(card.totals.played).toBe(0);
 expect(card.tournaments[0].history[0].score).toBe("W/O");
});
it("excludes an unaccepted doubles partner", () => {
 db.update(schema.entries).set({ partnerStatus: "pending" }).where(eq(schema.entries.id, "entry-a")).run();
 expect(getPlayerCard(db, "partner")!.tournaments).toEqual([]);
});

it("limits records and certificates to our current tournament and omits outside history", () => {
 db.insert(schema.tournaments).values({ id: "other", ...SEED_TOURNAMENT, name: "Other Open" }).run();
 db.update(schema.entries).set({ tournamentId: "other" }).run();
 db.update(schema.draws).set({ tournamentId: "other" }).run();
 const card = getPlayerCard(db, "a")!;
 expect(card.tournaments).toEqual([]);
 expect(card.totals).toEqual({ played: 0, won: 0, lost: 0 });
 expect(card).not.toHaveProperty("previous");
 expect(JSON.stringify(card)).not.toContain("Earlier Open");
});
