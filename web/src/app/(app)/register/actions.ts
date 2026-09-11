"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { requireUser } from "@/auth/require";
import { db } from "@/db/client";
import { entries, profiles, tournaments } from "@/db/schema";
import {
  CATEGORY_LABELS,
  PAYMENT_OUTCOMES,
  isDoubles,
  isUniqueViolation,
  validateEntryInput,
  type EntryFormState,
} from "@/lib/entries";

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

  // Not filtered by tournament: the unique index is on (user, category).
  const existingCategories = db
    .select({ category: entries.category })
    .from(entries)
    .where(eq(entries.userId, user.id))
    .all()
    .map((row) => row.category);

  const validation = validateEntryInput({
    category,
    partnerName,
    partnerEmail,
    existingCategories,
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
        partnerEmail: doubles ? partnerEmail.toLowerCase() : null,
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
