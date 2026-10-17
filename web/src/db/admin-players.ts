import { and, desc, eq, or } from "drizzle-orm";

import type { Database } from "./draws";
import { entries, profiles, users, type Entry, type Profile } from "./schema";

/** One of the player's entries, as their own or as the accepted partner on someone else's. */
export interface PlayerEntry {
  entry: Entry;
  /** "player": they made it; "partner": they joined someone else's doubles entry. */
  role: "player" | "partner";
  /** The other person on a doubles team, when there is one. */
  teammate: { userId: string | null; name: string } | null;
}

export interface AdminPlayer {
  userId: string;
  email: string;
  accountName: string | null;
  profile: Profile | null;
  entries: PlayerEntry[];
}

/** A player for the admin player page: account, profile and every entry in the tournament, newest first. */
export function getAdminPlayer(database: Database, userId: string, tournamentId: string): AdminPlayer | null {
  const user = database.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return null;
  const profile = database.select().from(profiles).where(eq(profiles.userId, userId)).get() ?? null;

  const rows = database
    .select({ entry: entries, ownerName: profiles.fullName, ownerAccount: users.name, ownerEmail: users.email })
    .from(entries)
    .innerJoin(users, eq(users.id, entries.userId))
    .leftJoin(profiles, eq(profiles.userId, entries.userId))
    .where(
      and(
        eq(entries.tournamentId, tournamentId),
        or(eq(entries.userId, userId), and(eq(entries.partnerUserId, userId), eq(entries.partnerStatus, "accepted"))),
      ),
    )
    .orderBy(desc(entries.createdAt))
    .all();

  return {
    userId: user.id,
    email: user.email,
    accountName: user.name,
    profile,
    entries: rows.map(({ entry, ownerName, ownerAccount, ownerEmail }) => {
      if (entry.userId === userId) {
        return {
          entry,
          role: "player",
          teammate: entry.partnerName === null ? null : { userId: entry.partnerUserId, name: entry.partnerName },
        };
      }
      return { entry, role: "partner", teammate: { userId: entry.userId, name: ownerName ?? ownerAccount ?? ownerEmail } };
    }),
  };
}
