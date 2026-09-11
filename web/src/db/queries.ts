import { desc, eq } from "drizzle-orm";

import { db } from "./client";
import { entries, profiles, tournaments, users, type Tournament } from "./schema";
import type { AdminEntryRow } from "@/lib/admin-entries";

/** The app runs one tournament at a time: the seeded row. */
export function getCurrentTournament(): Tournament | null {
  return db.select().from(tournaments).get() ?? null;
}

/** Every entry for a tournament with its player's account and profile, newest first. */
export function listTournamentEntries(tournamentId: string): AdminEntryRow[] {
  return db
    .select({ entry: entries, email: users.email, accountName: users.name, profile: profiles })
    .from(entries)
    .innerJoin(users, eq(entries.userId, users.id))
    .leftJoin(profiles, eq(profiles.userId, entries.userId))
    .where(eq(entries.tournamentId, tournamentId))
    .orderBy(desc(entries.createdAt))
    .all();
}

/** One entry with its player and tournament, or null when the id does not exist. */
export function getAdminEntry(
  entryId: string,
): (AdminEntryRow & { tournament: Tournament }) | null {
  return (
    db
      .select({
        entry: entries,
        email: users.email,
        accountName: users.name,
        profile: profiles,
        tournament: tournaments,
      })
      .from(entries)
      .innerJoin(users, eq(entries.userId, users.id))
      .innerJoin(tournaments, eq(entries.tournamentId, tournaments.id))
      .leftJoin(profiles, eq(profiles.userId, entries.userId))
      .where(eq(entries.id, entryId))
      .get() ?? null
  );
}
