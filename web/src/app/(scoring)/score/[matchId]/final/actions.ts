"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireScorer } from "@/auth/require";
import { getDb } from "@/db/client";
import { ScoreRejectedError, enterFinalScore, undoResult, walkoverMatch } from "@/db/matches";
import type { ActionState } from "@/lib/form-state";
import { MAX_PAPER_SETS, paperSetsFrom } from "@/lib/manual-score-form";
import { SIDES } from "@/lib/match";

function failed(error: string): ActionState {
  return { error, savedAt: null };
}

function matchIdFrom(formData: FormData): string {
  return String(formData.get("matchId") ?? "");
}

/** Runs a result change, turning a broken rule into a message for the scorer. */
function attempt(change: () => void): ActionState | null {
  try {
    change();
    return null;
  } catch (error) {
    if (error instanceof ScoreRejectedError) return failed(error.message);
    throw error;
  }
}

/** Draws, results, scoring and the Fan Zone all show a result, so all of them refresh. */
function showResult(matchId: string): never {
  revalidatePath("/", "layout");
  redirect(`/score/${matchId}`);
}

/** Saves a final score from paper. */
export async function finalScoreAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireScorer();
  const matchId = matchIdFrom(formData);
  const sets = paperSetsFrom(formData, MAX_PAPER_SETS);
  if (!sets.ok) return failed(sets.error);
  const problem = attempt(() => enterFinalScore(getDb(), matchId, sets.sets));
  if (problem !== null) return problem;
  showResult(matchId);
}

/** Records that one side did not turn up, so the other wins by walkover. */
export async function scorerWalkoverAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireScorer();
  const matchId = matchIdFrom(formData);
  const absentSide = SIDES.find((side) => side === formData.get("absentSide"));
  if (absentSide === undefined) return failed("Choose who did not play.");
  const problem = attempt(() => walkoverMatch(getDb(), matchId, absentSide));
  if (problem !== null) return problem;
  showResult(matchId);
}

/** Takes back a typed-in score or a walkover, while the next match has not started. */
export async function undoResultAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireScorer();
  const matchId = matchIdFrom(formData);
  const problem = attempt(() => undoResult(getDb(), matchId));
  if (problem !== null) return problem;
  revalidatePath("/", "layout");
  redirect(`/score/${matchId}/final`);
}
