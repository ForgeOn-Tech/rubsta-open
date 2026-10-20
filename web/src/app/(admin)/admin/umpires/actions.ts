"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/auth/require";
import { getDb } from "@/db/client";
import { getCurrentTournament } from "@/db/queries";
import { createUmpireLink, revokeUmpireLink } from "@/db/umpire-links";
import type { ActionState } from "@/lib/form-state";
import { ADMIN_UMPIRES_PATH, validateUmpireName } from "@/lib/umpire-links";

export async function addUmpireAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const tournament = getCurrentTournament();
  if (!tournament) return { error: "No tournament has been set up.", savedAt: null };
  const name = validateUmpireName(String(formData.get("name") ?? ""));
  if (!name.ok) return { error: name.error, savedAt: null };

  createUmpireLink(getDb(), { tournamentId: tournament.id, name: name.name, createdBy: admin.email, now: Date.now() });
  revalidatePath(ADMIN_UMPIRES_PATH);
  return { error: null, savedAt: Date.now() };
}

export async function revokeUmpireAction(formData: FormData): Promise<void> {
  await requireAdmin();
  revokeUmpireLink(getDb(), String(formData.get("linkId") ?? ""), Date.now());
  revalidatePath(ADMIN_UMPIRES_PATH);
  revalidatePath("/admin/order-of-play");
}
