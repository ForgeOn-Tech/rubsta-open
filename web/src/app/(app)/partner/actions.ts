"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/auth/require";
import { getDb } from "@/db/client";
import { PartnerRejectedError, respondToInvitation } from "@/db/partners";
import type { ActionState } from "@/lib/form-state";
import { PARTNER_DECISIONS, partnerInvitationPath } from "@/lib/partners";

/** The invited partner accepts or declines; the pressed button carries the decision. */
export async function respondToInvitationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const entryId = String(formData.get("entryId") ?? "");
  const answer = String(formData.get("decision") ?? "");
  const decision = PARTNER_DECISIONS.find((value) => value === answer);
  if (decision === undefined) throw new Error(`Unknown answer "${answer}" for entry ${entryId}.`);

  try {
    respondToInvitation(getDb(), entryId, { userId: user.id, email: user.email }, decision);
  } catch (error) {
    if (error instanceof PartnerRejectedError) return { error: error.message, savedAt: null };
    throw error;
  }

  revalidatePath(partnerInvitationPath(entryId));
  revalidatePath("/home");
  return { error: null, savedAt: Date.now() };
}
