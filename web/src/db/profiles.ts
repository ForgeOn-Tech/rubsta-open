import { eq, sql } from "drizzle-orm";

import type { Database } from "./draws";
import { profiles, type Profile } from "./schema";

/** What a player enters on the profile form. */
export type ProfileFields = Pick<
  typeof profiles.$inferInsert,
  "fullName" | "dateOfBirth" | "gender" | "mobile" | "club" | "bestRanking" | "previousTournaments" | "plays"
>;

/** Creates or updates a player's profile. A new profile takes the next player number, which never changes. */
export function upsertProfile(database: Database, userId: string, fields: ProfileFields): Profile {
  const existing = database
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .get();
  if (existing) {
    return database
      .update(profiles)
      .set({ ...fields, updatedAt: Date.now() })
      .where(eq(profiles.userId, userId))
      .returning()
      .get();
  }
  return database
    .insert(profiles)
    .values({
      ...fields,
      userId,
      // One statement, so two profiles made at the same moment cannot share a number.
      playerNumber: sql`(select coalesce(max(${profiles.playerNumber}), 0) + 1 from ${profiles})`,
    })
    .returning()
    .get();
}
