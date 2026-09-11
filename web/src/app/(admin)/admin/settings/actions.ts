"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/auth/require";
import { db } from "@/db/client";
import { tournaments } from "@/db/schema";
import { validateSettings, type SettingsFormState } from "@/lib/settings";

export async function saveTournamentSettings(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireAdmin();

  const tournamentId = String(formData.get("tournamentId") ?? "");
  const validation = validateSettings({
    name: String(formData.get("name") ?? ""),
    startsOn: String(formData.get("startsOn") ?? ""),
    endsOn: String(formData.get("endsOn") ?? ""),
    venue: String(formData.get("venue") ?? ""),
    entryClosesAt: String(formData.get("entryClosesAt") ?? ""),
    feeRupees: String(formData.get("feeRupees") ?? ""),
    status: String(formData.get("status") ?? ""),
    scheduleConfirmed: formData.get("scheduleConfirmed") === "on",
  });
  if (!validation.ok) return { error: validation.error, savedAt: null };

  const result = db
    .update(tournaments)
    .set(validation.settings)
    .where(eq(tournaments.id, tournamentId))
    .run();
  if (result.changes === 0) throw new Error(`Tournament ${tournamentId} does not exist.`);

  // Dates, venue and the provisional note appear on player and admin pages.
  revalidatePath("/", "layout");
  return { error: null, savedAt: Date.now() };
}
