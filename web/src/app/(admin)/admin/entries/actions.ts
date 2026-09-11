"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/auth/require";
import { db } from "@/db/client";
import { entries } from "@/db/schema";
import { isEntryStatus, statusUpdate } from "@/lib/entry-status";

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
  const result = db
    .update(entries)
    .set(statusUpdate(entry, to))
    .where(and(eq(entries.id, entryId), eq(entries.status, entry.status)))
    .run();
  if (result.changes === 0) {
    throw new Error(`Entry ${entryId} changed while updating. Reload and try again.`);
  }

  revalidatePath("/admin", "layout");
}
