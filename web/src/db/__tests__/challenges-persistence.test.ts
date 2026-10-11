// @vitest-environment node
import { randomUUID } from "node:crypto";
import SQLite from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, expect, it } from "vitest";
import * as schema from "../schema";
import { SEED_TOURNAMENT } from "../seed";
import { challengeLeaderboard, listChallengePlayers, saveChallengeAttempt, voidChallengeAttempt } from "../challenges";
import { parseChallengeScore } from "@/lib/challenges";
let sqlite: SQLite.Database;
let db: ReturnType<typeof drizzle<typeof schema>>;
beforeEach(() => {
  sqlite = new SQLite(":memory:"); sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema }); migrate(db, { migrationsFolder: "./drizzle" });
  db.insert(schema.tournaments).values({ id: "t", ...SEED_TOURNAMENT }).run();
  for (const id of ["a", "b", "c", "partner", "outsider"]) {
    db.insert(schema.users).values({ id, email: id + "@example.com" }).run();
    db.insert(schema.profiles).values({ userId: id, fullName: id, dateOfBirth: "2000-01-01", gender: "male", mobile: "123" }).run();
  }
  for (const id of ["a", "b", "c"]) db.insert(schema.entries).values({ id, userId: id, tournamentId: "t", category: "OS", status: "confirmed" }).run();
  db.insert(schema.entries).values({ id: "doubles", userId: "a", partnerUserId: "partner", partnerStatus: "accepted", tournamentId: "t", category: "OD", status: "confirmed" }).run();
});
afterEach(() => sqlite.close());
const input = (userId: string, value: string, kind = "serve") => ({ id: randomUUID(), tournamentId: "t", userId, kind, value, admin: "admin@example.com" });
it("counts only each player's best score and assigns tied competition ranks", () => {
  saveChallengeAttempt(db, input("a", "120.5")); saveChallengeAttempt(db, input("a", "110"));
  saveChallengeAttempt(db, input("b", "120.5")); saveChallengeAttempt(db, input("c", "100"));
  expect(challengeLeaderboard(db, "t", "serve").map(x => [x.userId, x.rank, x.score, x.attempts])).toEqual([["a",1,1205,2],["b",1,1205,1],["c",3,1000,1]]);
  expect(challengeLeaderboard(db, "other", "serve")).toEqual([]);
});
it("ranks lower reaction times first and allows zero accuracy hits", () => {
  saveChallengeAttempt(db, input("a", "250", "reaction")); saveChallengeAttempt(db, input("a", "200", "reaction"));
  saveChallengeAttempt(db, input("b", "180", "reaction")); saveChallengeAttempt(db, input("a", "0", "accuracy"));
  expect(challengeLeaderboard(db, "t", "reaction").map(x => x.userId)).toEqual(["b", "a"]);
  expect(challengeLeaderboard(db, "t", "accuracy")[0].score).toBe(0);
});
it("makes retried submissions safe and rejects a reused token with different data", () => {
  const attempt = input("a", "125"); saveChallengeAttempt(db, attempt); saveChallengeAttempt(db, attempt);
  expect(challengeLeaderboard(db, "t", "serve")[0].attempts).toBe(1);
  expect(() => saveChallengeAttempt(db, { ...attempt, value: "126" })).toThrow("already saved");
});
it("voids with an audit reason and restores the next best score", () => {
  saveChallengeAttempt(db, input("a", "100")); const best = input("a", "130"); saveChallengeAttempt(db, best);
  expect(() => voidChallengeAttempt(db, "other", best.id, "Wrong player", "admin")).toThrow("not found");
  expect(() => voidChallengeAttempt(db, "t", best.id, "", "admin")).toThrow("reason");
  voidChallengeAttempt(db, "t", best.id, "Wrong measurement", "admin");
  voidChallengeAttempt(db, "t", best.id, "Repeated correction", "other-admin");
  expect(challengeLeaderboard(db, "t", "serve")[0]).toMatchObject({ score: 1000, attempts: 1 });
  expect(db.select().from(schema.challengeAttempts).all().find(x => x.id === best.id)).toMatchObject({ voidReason: "Wrong measurement", voidedBy: "admin" });
});
it("includes accepted partners once and rejects unregistered accounts", () => {
  expect(listChallengePlayers(db, "t").map(x => x.userId)).toEqual(["a","b","c","partner"]);
  saveChallengeAttempt(db, input("partner", "90"));
  expect(() => saveChallengeAttempt(db, input("outsider", "90"))).toThrow("registered player");
  expect(() => saveChallengeAttempt(db, input("a", "90", "unknown"))).toThrow("Choose a challenge");
});
it("rejects invalid measurements without rounding away input errors", () => {
  for (const value of ["", "NaN", "Infinity", "1e2", "0", "301", "123.45", "-1"]) expect(() => parseChallengeScore("serve", value)).toThrow();
  for (const value of ["11", "1.5", "-1"]) expect(() => parseChallengeScore("accuracy", value)).toThrow();
  expect(() => parseChallengeScore("reaction", "0")).toThrow();
  expect(() => parseChallengeScore("reaction", "10001")).toThrow();
});
