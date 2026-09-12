"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/auth/require";
import { db, getDb } from "@/db/client";
import { CourtInUseError, addCourt, deleteCourt, updateCourt } from "@/db/courts";
import { getCurrentTournament } from "@/db/queries";
import { tournaments } from "@/db/schema";
import type { ActionState } from "@/lib/form-state";
import { validateCourt } from "@/lib/schedule";
import { validateSettings, type SettingsFormState } from "@/lib/settings";

function requireTournamentId(): string {
  const tournament = getCurrentTournament();
  if (!tournament) throw new Error("No tournament has been set up.");
  return tournament.id;
}

function courtNumberFrom(formData: FormData): number {
  const value = String(formData.get("courtNumber") ?? "");
  const courtNumber = Number(value);
  if (!Number.isInteger(courtNumber) || courtNumber < 1) throw new Error(`Unknown court "${value}".`);
  return courtNumber;
}

function courtFieldsFrom(formData: FormData) {
  return validateCourt({
    name: String(formData.get("name") ?? ""),
    surface: String(formData.get("surface") ?? ""),
    streamUrl: String(formData.get("streamUrl") ?? ""),
  });
}

function courtsSaved(): ActionState {
  // Court names show on the admin order of play and the umpires' start form.
  revalidatePath("/admin", "layout");
  revalidatePath("/score", "layout");
  // Stream links show in the Fan Zone.
  revalidatePath("/live", "layout");
  return { error: null, savedAt: Date.now() };
}

export async function addCourtAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const tournamentId = requireTournamentId();
  const fields = courtFieldsFrom(formData);
  if (!fields.ok) return { error: fields.error, savedAt: null };

  addCourt(getDb(), tournamentId, fields.value);
  return courtsSaved();
}

export async function updateCourtAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const tournamentId = requireTournamentId();
  const fields = courtFieldsFrom(formData);
  if (!fields.ok) return { error: fields.error, savedAt: null };

  updateCourt(getDb(), tournamentId, courtNumberFrom(formData), fields.value);
  return courtsSaved();
}

export async function deleteCourtAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const tournamentId = requireTournamentId();
  try {
    deleteCourt(getDb(), tournamentId, courtNumberFrom(formData));
  } catch (error) {
    if (error instanceof CourtInUseError) return { error: error.message, savedAt: null };
    throw error;
  }
  return courtsSaved();
}

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
