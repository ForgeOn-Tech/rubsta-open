import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";
import type { EventFees } from "@/lib/fees";

export const SEED_TOURNAMENT = {
  name: "Rubsta Open 2026",
  entryClosesAt: "2026-10-15T18:00:00+05:30",
  currency: "INR",
  status: "open" as const,
};

/** Rubsta Open 2026 fees in paise. The doubles fee covers the team. */
export const SEED_FEES: EventFees = {
  OS: 300000,
  W30: 250000,
  U15: 200000,
  OD: 400000,
  S40: 300000,
};

/** Idempotent startup seed: insert the event only when no tournament exists. */
export function seedTournamentIfEmpty(
  database: BetterSQLite3Database<typeof schema>,
) {
  const existing = database.select().from(schema.tournaments).all();
  if (existing.length > 0) return;
  database.transaction((tx) => {
    const tournament = tx.insert(schema.tournaments).values(SEED_TOURNAMENT).returning().get();
    tx.insert(schema.eventFees)
      .values(
        schema.CATEGORIES.map((category) => ({
          tournamentId: tournament.id,
          category,
          feeCents: SEED_FEES[category],
        })),
      )
      .run();
  });
}
