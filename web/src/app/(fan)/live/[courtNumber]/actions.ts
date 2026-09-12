"use server";

import { auth } from "@/auth/auth";
import { getDb } from "@/db/client";
import { FanRejectedError, addReaction, savePrediction } from "@/db/fan";
import { REACTION_KINDS, type ReactionKind } from "@/db/schema";
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

function kindFrom(formData: FormData): ReactionKind | null {
  const value = String(formData.get("kind") ?? "");
  return REACTION_KINDS.find((kind) => kind === value) ?? null;
}

/** Sends a fan's reaction to the match being played. Each kind counts once. */
export async function reactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Sign in to react.", savedAt: null };

  const kind = kindFrom(formData);
  if (kind === null) return { error: "That reaction does not exist.", savedAt: null };

  const matchId = String(formData.get("matchId") ?? "");
  try {
    addReaction(getDb(), matchId, userId, kind);
  } catch (error) {
    if (error instanceof FanRejectedError) return { error: error.message, savedAt: null };
    throw error;
  }

  return { error: null, savedAt: Date.now() };
}
