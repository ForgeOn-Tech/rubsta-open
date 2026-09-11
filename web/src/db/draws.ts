import { and, asc, eq, inArray } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";
import { drawSlots, draws, entries, type Category, type Draw, type DrawSlot, type DrawStatus } from "./schema";
import { DRAW_ELIGIBLE_STATUSES, type DrawEntrant, type DrawLine } from "@/lib/draws";

/** Takes the database as an argument so tests can pass an in-memory one. */
export type Database = BetterSQLite3Database<typeof schema>;

export interface DrawWithSlots {
  draw: Draw;
  slots: DrawSlot[];
}

/** Every draw for a tournament with its slots in line order. */
export function listDrawsWithSlots(database: Database, tournamentId: string): DrawWithSlots[] {
  const tournamentDraws = database
    .select()
    .from(draws)
    .where(eq(draws.tournamentId, tournamentId))
    .all();
  if (tournamentDraws.length === 0) return [];

  const slots = database
    .select()
    .from(drawSlots)
    .where(
      inArray(
        drawSlots.drawId,
        tournamentDraws.map((draw) => draw.id),
      ),
    )
    .orderBy(asc(drawSlots.position))
    .all();
  return tournamentDraws.map((draw) => ({
    draw,
    slots: slots.filter((slot) => slot.drawId === draw.id),
  }));
}

export function getDrawWithSlots(
  database: Database,
  tournamentId: string,
  category: Category,
): DrawWithSlots | null {
  return (
    listDrawsWithSlots(database, tournamentId).find((item) => item.draw.category === category) ??
    null
  );
}

/**
 * Creates the event's draw, or replaces a draft draw's lines, in one
 * transaction. Refuses a published draw.
 */
export function saveGeneratedDraw(
  database: Database,
  input: { tournamentId: string; category: Category; lines: readonly DrawLine[] },
): string {
  return database.transaction((tx) => {
    const existing = tx
      .select()
      .from(draws)
      .where(and(eq(draws.tournamentId, input.tournamentId), eq(draws.category, input.category)))
      .get();
    if (existing?.status === "published") {
      throw new Error(
        `The ${input.category} draw is published. Move it back to draft before generating it again.`,
      );
    }

    const drawId = existing?.id ?? crypto.randomUUID();
    if (existing) {
      tx.delete(drawSlots).where(eq(drawSlots.drawId, drawId)).run();
      tx.update(draws)
        .set({ size: input.lines.length, generatedAt: Date.now(), publishedAt: null })
        .where(eq(draws.id, drawId))
        .run();
    } else {
      tx.insert(draws)
        .values({
          id: drawId,
          tournamentId: input.tournamentId,
          category: input.category,
          size: input.lines.length,
        })
        .run();
    }

    tx.insert(drawSlots)
      .values(
        input.lines.map((line) => ({
          drawId,
          position: line.position,
          entryId: line.entryId,
          seed: line.seed,
        })),
      )
      .run();
    return drawId;
  });
}

/** Moves a draw between draft and published, only if it is still in `from`. */
export function setDrawStatus(
  database: Database,
  drawId: string,
  from: DrawStatus,
  to: DrawStatus,
): void {
  const result = database
    .update(draws)
    .set({ status: to, publishedAt: to === "published" ? Date.now() : null })
    .where(and(eq(draws.id, drawId), eq(draws.status, from)))
    .run();
  if (result.changes === 0) {
    throw new Error(`Draw ${drawId} is not ${from}. Reload and try again.`);
  }
}

/**
 * Sets seeds on an event's accepted entries and clears every other seed in
 * the event, in one transaction.
 */
export function saveSeeds(
  database: Database,
  tournamentId: string,
  category: Category,
  seeds: readonly DrawEntrant[],
): void {
  database.transaction((tx) => {
    tx.update(entries)
      .set({ seed: null })
      .where(and(eq(entries.tournamentId, tournamentId), eq(entries.category, category)))
      .run();

    for (const { entryId, seed } of seeds) {
      if (seed === null) continue;
      const result = tx
        .update(entries)
        .set({ seed })
        .where(
          and(
            eq(entries.id, entryId),
            eq(entries.tournamentId, tournamentId),
            eq(entries.category, category),
            inArray(entries.status, [...DRAW_ELIGIBLE_STATUSES]),
          ),
        )
        .run();
      if (result.changes === 0) {
        throw new Error(`Entry ${entryId} is not an accepted ${category} entry.`);
      }
    }
  });
}
