"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/auth/require";
import { getDb } from "@/db/client";
import { getCurrentTournament } from "@/db/queries";
import { saveChallengeAttempt, voidChallengeAttempt } from "@/db/challenges";
export type ChallengeState = { error: string | null; savedAt: number | null; token: string };
export async function recordAttempt(previous: ChallengeState, form: FormData): Promise<ChallengeState> {
  const admin = await requireAdmin();
  const tournament = getCurrentTournament();
  if (!tournament) return { ...previous, error: "No tournament is available." };
  try {
    saveChallengeAttempt(getDb(), { id: previous.token, tournamentId: tournament.id, userId: String(form.get("player") ?? ""), kind: String(form.get("kind") ?? ""), value: String(form.get("score") ?? ""), admin: admin.email });
  } catch (error) { return { ...previous, error: error instanceof Error ? error.message : "Could not save this attempt." }; }
  revalidatePath("/admin/challenges");
  revalidatePath("/challenges");
  return { error: null, savedAt: Date.now(), token: crypto.randomUUID() };
}
export async function voidAttempt(previous: ChallengeState, form: FormData): Promise<ChallengeState> {
  const admin = await requireAdmin();
  const tournament = getCurrentTournament();
  if (!tournament) return { ...previous, error: "No tournament is available." };
  try { voidChallengeAttempt(getDb(), tournament.id, String(form.get("id") ?? ""), String(form.get("reason") ?? ""), admin.email); }
  catch (error) { return { ...previous, error: error instanceof Error ? error.message : "Could not remove this attempt." }; }
  revalidatePath("/admin/challenges");
  revalidatePath("/challenges");
  return { ...previous, error: null, savedAt: Date.now() };
}
