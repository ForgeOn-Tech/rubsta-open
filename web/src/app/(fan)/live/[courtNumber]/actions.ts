"use server";

import { auth } from "@/auth/auth";
import { getDb } from "@/db/client";
import { FanRejectedError, savePrediction } from "@/db/fan";
import type { ActionState } from "@/lib/form-state";
import { SIDES, type Side } from "@/lib/match";

function sideFrom(formData: FormData): Side | null {
  const value = String(formData.get("side") ?? "");
  return SIDES.find((side) => side === value) ?? null;
}

/** Records a fan's pick for the set being played. */
export async function predictAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Sign in to call the set.", savedAt: null };

  const side = sideFrom(formData);
  if (side === null) return { error: "Pick one of the two players.", savedAt: null };
  const setNumber = Number(formData.get("setNumber") ?? "");
  if (!Number.isInteger(setNumber) || setNumber < 1) {
    return { error: "That set is not being played.", savedAt: null };
  }

  try {
    savePrediction(getDb(), {
      matchId: String(formData.get("matchId") ?? ""),
      setNumber,
      userId,
      side,
    });
  } catch (error) {
    if (error instanceof FanRejectedError) return { error: error.message, savedAt: null };
    throw error;
  }

  // The page polls for the new split, so nothing is revalidated here.
  return { error: null, savedAt: Date.now() };
}
