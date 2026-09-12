import { and, asc, eq } from "drizzle-orm";

import type { Database } from "./draws";
import { courts, scheduleDays, scheduleItems, type Court } from "./schema";
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

/** Renames a court, changes its surface or its stream link. Its number stays. */
export function updateCourt(
  database: Database,
  tournamentId: string,
  courtNumber: number,
  fields: CourtFields,
): void {
  const result = database
    .update(courts)
    .set({ name: fields.name, surface: fields.surface, streamUrl: fields.streamUrl })
    .where(and(eq(courts.tournamentId, tournamentId), eq(courts.number, courtNumber)))
    .run();
  if (result.changes === 0) throw new Error(`Court ${courtNumber} does not exist.`);
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
