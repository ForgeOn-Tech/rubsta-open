"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/auth/require";
import { AdminEntryRejectedError, addAdminEntry } from "@/db/admin-add-entry";
import { db, getDb } from "@/db/client";
import { getCurrentTournament } from "@/db/queries";
import { entries, type EntryStatus } from "@/db/schema";
import { validateAdminEntry, type RawPerson } from "@/lib/admin-add-entry";
import { ADMIN_ENTRIES_PATH } from "@/lib/admin-entries";
import { isUniqueViolation } from "@/lib/entries";
import type { ActionState } from "@/lib/form-state";
import { isEntryStatus, statusUpdate } from "@/lib/entry-status";

/** Reinstating fails when the player has entered the same event again since it was cancelled. */
function updateStatus(entryId: string, entry: { status: EntryStatus; paymentRef: string | null }, to: EntryStatus): number {
  try {
    return db
      .update(entries)
      .set(statusUpdate(entry, to))
      .where(and(eq(entries.id, entryId), eq(entries.status, entry.status)))
      .run().changes;
  } catch (error) {
    if (isUniqueViolation(error)) throw new Error("Player already has an active entry in this category.");
    throw error;
  }
}

export async function changeEntryStatus(formData: FormData): Promise<void> {
  await requireAdmin();

  const entryId = String(formData.get("entryId") ?? "");
  const to = String(formData.get("to") ?? "");
  if (!isEntryStatus(to)) throw new Error(`Unknown entry status "${to}".`);

  const entry = db
    .select({ status: entries.status, paymentRef: entries.paymentRef })
    .from(entries)
    .where(eq(entries.id, entryId))
    .get();
  if (!entry) throw new Error(`Entry ${entryId} does not exist.`);

  // Only update if nobody changed the status since it was read.
  if (updateStatus(entryId, entry, to) === 0) {
    throw new Error(`Entry ${entryId} changed while updating. Reload and try again.`);
  }

  revalidatePath("/admin", "layout");
}

function personFields(formData: FormData, prefix: string): RawPerson {
  const field = (name: string) => String(formData.get(`${prefix}${name}`) ?? "");
  return {
    fullName: field("FullName"),
    email: field("Email"),
    dateOfBirth: field("DateOfBirth"),
    gender: field("Gender"),
    mobile: field("Mobile"),
    club: field("Club"),
  };
}

/** Adds an entry by hand, for a player who did not register online. */
export async function addEntry(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const tournament = getCurrentTournament();
  if (!tournament) return { error: "No tournament has been set up.", savedAt: null };

  const validation = validateAdminEntry({
    category: String(formData.get("category") ?? ""),
    status: String(formData.get("status") ?? ""),
    player: personFields(formData, "player"),
    partner: personFields(formData, "partner"),
  }, new Date());
  if (!validation.ok) return { error: validation.error, savedAt: null };

  let entryId: string;
  try {
    entryId = addAdminEntry(getDb(), tournament.id, validation.input, Date.now());
  } catch (error) {
    if (error instanceof AdminEntryRejectedError) return { error: error.message, savedAt: null };
    if (isUniqueViolation(error)) return { error: "This player already has an entry in this event.", savedAt: null };
    throw error;
  }

  revalidatePath("/admin", "layout");
  redirect(`${ADMIN_ENTRIES_PATH}/${entryId}`);
}
