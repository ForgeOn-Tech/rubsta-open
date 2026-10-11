"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/auth/require";
import { getDb } from "@/db/client";
import { getCurrentTournament } from "@/db/queries";
import { saveBroadcast } from "@/db/broadcasts";
import type { ActionState } from "@/lib/form-state";

export async function saveStream(_previous: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const tournament = getCurrentTournament();
  if (!tournament) return { error: "No tournament is available.", savedAt: null };
  const courtNumber = Number(form.get("courtNumber"));
  if (!Number.isSafeInteger(courtNumber) || courtNumber < 1) return { error: "Choose a court.", savedAt: null };
  try {
    saveBroadcast(getDb(), tournament.id, courtNumber, {
      status: String(form.get("status") ?? ""),
      streamUrl: String(form.get("streamUrl") ?? ""),
      replayUrl: String(form.get("replayUrl") ?? ""),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the stream.", savedAt: null };
  }
  for (const path of ["/admin/streaming", "/admin/settings", "/live", `/live/${courtNumber}`]) revalidatePath(path);
  return { error: null, savedAt: Date.now() };
}
