// @vitest-environment node
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { expect, it } from "vitest";
import * as schema from "@/db/schema";
import { seedTournamentIfEmpty } from "@/db/seed";
import { getEventFees } from "@/db/fees";

it("adds the team fee to existing tournaments without changing existing fees", () => {
  const sqlite = new Database(":memory:");
  try {
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: "./drizzle" });
    seedTournamentIfEmpty(db);
    const tournament = db.select().from(schema.tournaments).get()!;
    expect(getEventFees(db, tournament.id).D40).toBe(300000);
    sqlite.exec("DELETE FROM event_fees WHERE category = 'D40'; UPDATE event_fees SET fee_cents = 350000 WHERE category = 'OS';");
    const migration = readFileSync("./drizzle/0019_forty_plus_doubles.sql", "utf8");
    sqlite.exec(migration);
    expect(getEventFees(db, tournament.id)).toMatchObject({ D40: 300000, OS: 350000 });
    sqlite.exec("UPDATE event_fees SET fee_cents = 320000 WHERE category = 'D40'");
    sqlite.exec(migration);
    expect(getEventFees(db, tournament.id).D40).toBe(320000);
  } finally { sqlite.close(); }
});
