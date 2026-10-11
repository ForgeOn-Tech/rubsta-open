"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/auth/require";
import { getDb } from "@/db/client";
import { disablePlayerCardShare, enablePlayerCardShare, getPlayerCardShare } from "@/db/player-cards";
export type ShareState = { token: string | null; error: string | null };
export async function setCardSharing(previous: ShareState, form: FormData): Promise<ShareState> {
  const user = await requireUser();
  const db = getDb();
  const old = getPlayerCardShare(db, user.id);
  let token: string | null = null;
  try {
    if (form.get("intent") === "enable") token = enablePlayerCardShare(db, user.id).token;
    else if (form.get("intent") === "disable") disablePlayerCardShare(db, user.id);
    else return { ...previous, error: "Choose whether to enable or disable sharing." };
  } catch (error) { return { token: old?.token ?? null, error: error instanceof Error ? error.message : "Could not update sharing." }; }
  revalidatePath("/player-card");
  if (old) revalidatePath(`/players/${old.token}`);
  return { token, error: null };
}
