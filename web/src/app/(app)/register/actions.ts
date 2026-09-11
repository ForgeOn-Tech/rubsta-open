"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/auth/require";
import { db, getDb } from "@/db/client";
import { PartnerRejectedError, changePartner, listPlayedCategories } from "@/db/partners";
import { entries, profiles, tournaments } from "@/db/schema";
import {
  CATEGORY_LABELS,
  PAYMENT_OUTCOMES,
  isDoubles,
  isUniqueViolation,
  validateEntryInput,
  type EntryFormState,
} from "@/lib/entries";
import type { ActionState } from "@/lib/form-state";
import { normaliseEmail } from "@/lib/partners";

export async function submitEntry(
  _prev: EntryFormState,
  formData: FormData,
): Promise<EntryFormState> {
  const user = await requireUser();

  const tournamentId = String(formData.get("tournamentId") ?? "");
  const category = String(formData.get("category") ?? "");
  const partnerName = String(formData.get("partnerName") ?? "").trim();
  const partnerEmail = String(formData.get("partnerEmail") ?? "").trim();

  const profile = db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .get();
  if (!profile) redirect("/profile");

  const tournament = db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .get();
  if (!tournament) return { error: "This tournament is not available." };

  const validation = validateEntryInput({
    category,
    partnerName,
    partnerEmail,
    ownEmail: user.email,
    // Not filtered by tournament: the unique index is on (user, category).
    existingCategories: listPlayedCategories(getDb(), user.id),
    entryClosesAt: tournament.entryClosesAt,
    tournamentStatus: tournament.status,
  });
  if (!validation.ok) return { error: validation.error };

  const doubles = isDoubles(validation.category);
  const outcome =
    process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true"
      ? PAYMENT_OUTCOMES.stub
      : PAYMENT_OUTCOMES.disabled;
  const id = crypto.randomUUID();

  try {
    db.insert(entries)
      .values({
        id,
        userId: user.id,
        tournamentId: tournament.id,
        category: validation.category,
        partnerName: doubles ? partnerName : null,
        partnerEmail: doubles ? normaliseEmail(partnerEmail) : null,
        partnerStatus: doubles ? "pending" : null,
        status: outcome.status,
        paymentRef: outcome.paymentRef,
      })
      .run();
  } catch (error) {
    // A double submit can pass validation twice; the index is the real guard.
    if (isUniqueViolation(error)) {
      return {
        error: `You already have a ${CATEGORY_LABELS[validation.category]} entry.`,
      };
    }
    throw error;
  }

  redirect(`/register/${id}`);
}

/** Names a new doubles partner, who then has to accept. */
export async function changePartnerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const entryId = String(formData.get("entryId") ?? "");

  try {
    changePartner(
      getDb(),
      entryId,
      { userId: user.id, email: user.email },
      {
        name: String(formData.get("partnerName") ?? ""),
        email: String(formData.get("partnerEmail") ?? ""),
      },
    );
  } catch (error) {
    if (error instanceof PartnerRejectedError) return { error: error.message, savedAt: null };
    throw error;
  }

  revalidatePath(`/register/${entryId}`);
  revalidatePath("/home");
  return { error: null, savedAt: Date.now() };
}
