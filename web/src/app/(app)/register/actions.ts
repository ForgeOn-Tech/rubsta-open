"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/auth/require";
import { db, getDb } from "@/db/client";
import { PartnerRejectedError, changePartner, listPlayedCategories } from "@/db/partners";
import { entries, entryBundles, profiles, tournaments } from "@/db/schema";
import {
  isDoubles,
  isUniqueViolation,
  validateEntryInput,
  type EntryFormState,
} from "@/lib/entries";
import type { ActionState } from "@/lib/form-state";
import { awaitsPayment } from "@/lib/entry-status";
import { normaliseEmail } from "@/lib/partners";
import { razorpayConfig } from "@/lib/razorpay";
import { registrationOption } from "@/lib/registration-pricing";

export async function submitEntry(
  _prev: EntryFormState,
  formData: FormData,
): Promise<EntryFormState> {
  const user = await requireUser();

  const tournamentId = String(formData.get("tournamentId") ?? "");
  const selection = registrationOption(String(formData.get("selection") ?? formData.get("category") ?? ""));
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

  if (!selection) return { error: "Choose an event or approved combo." };
  const existingCategories = listPlayedCategories(getDb(), user.id);
  for (const category of selection.categories) {
    const validation = validateEntryInput({ category, partnerName, partnerEmail, ownEmail: user.email, existingCategories, entryClosesAt: tournament.entryClosesAt, tournamentStatus: tournament.status });
    if (!validation.ok) return { error: validation.error };
  }
  const ids = selection.categories.map(() => crypto.randomUUID());
  const bundleId = selection.categories.length === 2 ? crypto.randomUUID() : null;

  try {
    db.transaction((tx) => {
      if (bundleId) tx.insert(entryBundles).values({ id: bundleId, userId: user.id, tournamentId: tournament.id }).run();
      tx.insert(entries).values(selection.categories.map((category, index) => ({
        id: ids[index], userId: user.id, tournamentId: tournament.id, bundleId, category,
        partnerName: isDoubles(category) ? partnerName : null,
        partnerEmail: isDoubles(category) ? normaliseEmail(partnerEmail) : null,
        partnerStatus: isDoubles(category) ? "pending" as const : null, status: "submitted" as const,
      }))).run();
    });
  } catch (error) {
    // A double submit can pass validation twice; the index is the real guard.
    if (isUniqueViolation(error)) {
      return {
        error: "You have already entered one of these events.",
      };
    }
    throw error;
  }

  // When the fee is due online, the entry page opens Razorpay Checkout straight away.
  const payNow = awaitsPayment({
    paymentsOn: razorpayConfig(process.env) !== null,
    feeCents: 1,
    status: "submitted",
  });
  redirect(payNow ? `/register/${ids[0]}?pay=1` : `/register/${ids[0]}`);
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
