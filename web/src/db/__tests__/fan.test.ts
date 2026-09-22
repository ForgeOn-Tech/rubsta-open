// @vitest-environment node
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { expect, it } from "vitest";
import * as schema from "@/db/schema";
import { SEED_TOURNAMENT } from "@/db/seed";
import { getFanDraws } from "@/db/fan";
import { saveGeneratedDraw, setDrawStatus } from "@/db/draws";

it("only exposes published draws in the requested tournament, with public player fields", () => {
  const sqlite = new Database(":memory:");
  try {
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: "./drizzle" });
    db.insert(schema.tournaments).values({ id: "event", ...SEED_TOURNAMENT }).run();
    db.insert(schema.users).values({ id: "user", name: "Alex", email: "private@example.com" }).run();
    db.insert(schema.entries).values({ id: "entry", userId: "user", tournamentId: "event", category: "MD", partnerName: "Sam", partnerEmail: "partner@example.com", paymentRef: "secret-payment" }).run();
    const id = saveGeneratedDraw(db, { tournamentId: "event", category: "MD", lines: [
      { position: 1, entryId: "entry", seed: 1 }, { position: 2, entryId: null, seed: null },
    ] });
    expect(getFanDraws(db, "event")).toEqual([]);
    setDrawStatus(db, id, "draft", "published");
    const result = getFanDraws(db, "event");
    expect(result[0].slots).toEqual([
      { position: 1, entryId: "entry", seed: 1, label: "Alex / Sam" },
      { position: 2, entryId: null, seed: null, label: "Bye" },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/private@example|partner@example|secret-payment|userId/);
    expect(getFanDraws(db, "other-event")).toEqual([]);
    setDrawStatus(db, id, "published", "draft");
    expect(getFanDraws(db, "event")).toEqual([]);
  } finally { sqlite.close(); }
});
