import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { seedTournamentIfEmpty } from "./seed";
import * as schema from "./schema";

const DEFAULT_DB_PATH = "./data/tournament.db";

function createDb() {
  const dbPath = process.env.DATABASE_PATH ?? DEFAULT_DB_PATH;
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  }
  const sqlite = new Database(dbPath, { timeout: 10_000 });
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 10000");
  sqlite.pragma("foreign_keys = ON");
  const database = drizzle(sqlite, { schema });

  // Migrations from drizzle/ are applied at server start, then the seed runs
  // idempotently (INSERT only when the table is empty).
  migrate(database, { migrationsFolder: "./drizzle" });
  seedTournamentIfEmpty(database);

  return database;
}

type Db = ReturnType<typeof createDb>;

// Reuse a single connection across Next.js hot reloads, and open it lazily so
// importing this module (e.g. during build page-data collection) does not
// touch the database file.
const globalForDb = globalThis as unknown as { tournamentDb?: Db };

/** The real drizzle instance, for code that type-checks it (the Auth.js adapter). */
export function getDb(): Db {
  if (!globalForDb.tournamentDb) {
    globalForDb.tournamentDb = createDb();
  }
  return globalForDb.tournamentDb;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const value = getDb()[prop as keyof Db];
    return typeof value === "function" ? value.bind(getDb()) : value;
  },
});
