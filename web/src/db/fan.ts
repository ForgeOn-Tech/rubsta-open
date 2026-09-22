import { and, asc, eq } from "drizzle-orm";
import type { Database } from "./draws";
import { draws, drawSlots, entries, profiles, users } from "./schema";

/** Public projection: never return contact details, payments or unpublished entries. */
export function getFanDraws(database: Database, tournamentId: string) {
  return database.transaction((tx) => {
    const published = tx.select({ id: draws.id, category: draws.category, size: draws.size })
      .from(draws).where(and(eq(draws.tournamentId, tournamentId), eq(draws.status, "published"))).all();
    return published.map((draw) => ({
      ...draw,
      slots: tx.select({
        position: drawSlots.position, entryId: drawSlots.entryId, seed: drawSlots.seed,
        name: profiles.fullName, accountName: users.name, partnerName: entries.partnerName,
      }).from(drawSlots)
        .leftJoin(entries, eq(entries.id, drawSlots.entryId))
        .leftJoin(users, eq(users.id, entries.userId))
        .leftJoin(profiles, eq(profiles.userId, users.id))
        .where(eq(drawSlots.drawId, draw.id)).orderBy(asc(drawSlots.position)).all()
        .map(({ name, accountName, partnerName, ...slot }) => ({
          ...slot,
          label: slot.entryId === null ? "Bye" : [name || accountName || "Player", partnerName].filter(Boolean).join(" / "),
        })),
    }));
  });
}

export type FanDraw = ReturnType<typeof getFanDraws>[number];
