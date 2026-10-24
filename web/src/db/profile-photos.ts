import { eq } from "drizzle-orm";

import type { Database } from "./draws";
import { profilePhotos } from "./schema";

/** The player's photo as JPEG bytes, or null when they have none. */
export function getProfilePhoto(database: Database, userId: string): Buffer | null {
  const row = database.select({ jpeg: profilePhotos.jpeg }).from(profilePhotos).where(eq(profilePhotos.userId, userId)).get();
  return row === undefined ? null : Buffer.from(row.jpeg, "base64");
}

/** When the player last changed their photo, or null when they have none. */
export function profilePhotoVersion(database: Database, userId: string): number | null {
  const row = database
    .select({ updatedAt: profilePhotos.updatedAt })
    .from(profilePhotos)
    .where(eq(profilePhotos.userId, userId))
    .get();
  return row?.updatedAt ?? null;
}

/** Saves or replaces the player's photo, with the consent they gave for it. */
export function saveProfilePhoto(
  database: Database,
  input: { userId: string; jpeg: Buffer; consentText: string; now: number },
): void {
  const values = {
    jpeg: input.jpeg.toString("base64"),
    updatedAt: input.now,
    consentAt: input.now,
    consentText: input.consentText,
  };
  database
    .insert(profilePhotos)
    .values({ userId: input.userId, ...values })
    .onConflictDoUpdate({ target: profilePhotos.userId, set: values })
    .run();
}

export function deleteProfilePhoto(database: Database, userId: string): void {
  database.delete(profilePhotos).where(eq(profilePhotos.userId, userId)).run();
}
