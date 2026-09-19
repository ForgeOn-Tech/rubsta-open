import { eq } from "drizzle-orm";

import type { Database } from "./draws";
import { CATEGORIES, eventFees } from "./schema";
import type { EventFees } from "@/lib/fees";

/** The fee for every event. A missing event means a broken migration or seed, so it throws. */
export function getEventFees(database: Database, tournamentId: string): EventFees {
  const rows = database.select().from(eventFees).where(eq(eventFees.tournamentId, tournamentId)).all();
  const byCategory = new Map(rows.map((row) => [row.category, row.feeCents]));
  return Object.fromEntries(
    CATEGORIES.map((category) => {
      const feeCents = byCategory.get(category);
      if (feeCents === undefined) {
        throw new Error(`Tournament ${tournamentId} has no entry fee for ${category}.`);
      }
      return [category, feeCents];
    }),
  ) as EventFees;
}

/** Writes every event's fee, adding rows that do not exist yet. */
export function saveEventFees(database: Database, tournamentId: string, fees: EventFees): void {
  for (const category of CATEGORIES) {
    database
      .insert(eventFees)
      .values({ tournamentId, category, feeCents: fees[category] })
      .onConflictDoUpdate({
        target: [eventFees.tournamentId, eventFees.category],
        set: { feeCents: fees[category] },
      })
      .run();
  }
}
