"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/auth/require";
import { db } from "@/db/client";
import { entries, type EntryStatus } from "@/db/schema";
import { isUniqueViolation } from "@/lib/entries";
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
