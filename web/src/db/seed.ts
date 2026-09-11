import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

export const SEED_TOURNAMENT = {
  name: "Rubsta Open 2026",
  entryClosesAt: "2026-09-22T18:00:00+05:30",
  feeCents: 150000,
  currency: "INR",
  status: "open" as const,
};

/** Idempotent startup seed: insert the event only when no tournament exists. */
export function seedTournamentIfEmpty(
  database: BetterSQLite3Database<typeof schema>,
) {
  const existing = database.select().from(schema.tournaments).all();
  if (existing.length > 0) return;
  database.insert(schema.tournaments).values(SEED_TOURNAMENT).run();
}
