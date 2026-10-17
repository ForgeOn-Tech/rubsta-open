import { and, asc, eq } from "drizzle-orm";

import type { Database } from "./draws";
import { courtBroadcasts, courts, scheduleDays, scheduleItems, type Court } from "./schema";
import { nextCourtNumber, type CourtFields } from "@/lib/schedule";

/** A court on the order of play, working or published, cannot be deleted. */
export class CourtInUseError extends Error {
  constructor(courtNumber: number) {
    super(`Court ${courtNumber} is on the order of play. Move its matches and sessions first.`);
    this.name = "CourtInUseError";
  }
}

/** A tournament's courts in number order. */
export function listCourts(database: Database, tournamentId: string): Court[] {
  return database
    .select()
    .from(courts)
    .where(eq(courts.tournamentId, tournamentId))
    .orderBy(asc(courts.number))
    .all();
}

/** Adds a court with the next free number. */
export function addCourt(database: Database, tournamentId: string, fields: CourtFields): Court {
  return database.transaction((tx) => {
    const number = nextCourtNumber(listCourts(tx, tournamentId));
    return tx
      .insert(courts)
      .values({
        tournamentId,
        number,
        name: fields.name,
        surface: fields.surface,
        streamUrl: fields.streamUrl,
      })
      .returning()
      .get();
  });
}

/** Adds unnamed courts until the tournament has `count`. Returns how many it added. */
export function addCourtsUpTo(database: Database, tournamentId: string, count: number): number {
  return database.transaction((tx) => {
    const missing = Math.max(0, count - listCourts(tx, tournamentId).length);
    for (let index = 0; index < missing; index++) {
      addCourt(tx, tournamentId, { name: null, surface: null, streamUrl: null });
    }
    return missing;
  });
}

/** Renames a court, changes its surface or its stream link. Its number stays. */
export function updateCourt(
  database: Database,
  tournamentId: string,
  courtNumber: number,
  fields: CourtFields,
): void {
  database.transaction(tx => {
    const court = tx.select().from(courts).where(and(eq(courts.tournamentId, tournamentId), eq(courts.number, courtNumber))).get();
    if (!court) throw new Error(`Court ${courtNumber} does not exist.`);
    tx.update(courts).set({ name: fields.name, surface: fields.surface, streamUrl: fields.streamUrl }).where(eq(courts.id, court.id)).run();
    // A replacement video has not been checked live. Clear the previous replay too.
    if (court.streamUrl !== fields.streamUrl) tx.update(courtBroadcasts)
      .set({ status: fields.streamUrl ? "scheduled" : "off", replayUrl: null, updatedAt: Date.now() })
      .where(eq(courtBroadcasts.courtId, court.id)).run();
  });
}

/** Deletes a court that no working or published order of play uses. */
export function deleteCourt(database: Database, tournamentId: string, courtNumber: number): void {
  database.transaction((tx) => {
    const working = tx
      .select({ id: scheduleItems.id })
      .from(scheduleItems)
      .where(
        and(eq(scheduleItems.tournamentId, tournamentId), eq(scheduleItems.courtNumber, courtNumber)),
      )
      .get();
    const published = tx
      .select({ items: scheduleDays.items })
      .from(scheduleDays)
      .where(eq(scheduleDays.tournamentId, tournamentId))
      .all()
      .some((day) => day.items.some((item) => item.courtNumber === courtNumber));
    if (working !== undefined || published) throw new CourtInUseError(courtNumber);

    const result = tx
      .delete(courts)
      .where(and(eq(courts.tournamentId, tournamentId), eq(courts.number, courtNumber)))
      .run();
    if (result.changes === 0) throw new Error(`Court ${courtNumber} does not exist.`);
  });
}
