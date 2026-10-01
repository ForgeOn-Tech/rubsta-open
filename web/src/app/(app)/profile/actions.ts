"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { submitEntry } from "../register/actions";
import { listPlayedCategories } from "@/db/partners";
import { tournaments } from "@/db/schema";
import { validateEntryInput } from "@/lib/entries";

import { requireUser } from "@/auth/require";
import { getDb } from "@/db/client";
import { upsertProfile } from "@/db/profiles";
import { GENDERS, HANDS, type Gender, type PreviousTournament } from "@/db/schema";
import { ageFromDob } from "@/lib/age";
import { registrationOption } from "@/lib/registration-pricing";

export interface ProfileFormState {
  error: string | null;
}

export async function saveProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser();

  const fullName = String(formData.get("fullName") ?? "").trim();
  const dateOfBirth = String(formData.get("dateOfBirth") ?? "").trim();
  const gender = String(formData.get("gender") ?? "") as Gender;
  const mobile = String(formData.get("mobile") ?? "").trim();
  const club = String(formData.get("club") ?? "").trim();
  const bestRanking = String(formData.get("bestRanking") ?? "").trim();
  const playsInput = String(formData.get("plays") ?? "");
  const previousTournaments = parsePreviousTournaments(
    String(formData.get("previousTournaments") ?? "[]"),
  );

  if (!fullName) return { error: "Full name is required." };
  if (ageFromDob(dateOfBirth) === null) {
    return { error: "Enter a valid date of birth." };
  }
  if (!GENDERS.includes(gender)) return { error: "Choose a gender." };
  if (!mobile) return { error: "Mobile number is required." };
  const plays = HANDS.find((hand) => hand === playsInput);
  if (playsInput !== "" && plays === undefined) return { error: "Choose the hand you play with." };

  const registering = formData.get("intent") === "register";
  if (registering) {
    const tournament = getDb().select().from(tournaments)
      .where(eq(tournaments.id, String(formData.get("tournamentId") ?? ""))).get();
    if (!tournament) return { error: "This tournament is not available." };
    const selection = registrationOption(String(formData.get("selection") ?? formData.get("category") ?? ""));
    if (!selection) return { error: "Choose an event or approved combo." };
    for (const category of selection.categories) {
      const validation = validateEntryInput({ category, partnerName: String(formData.get("partnerName") ?? "").trim(), partnerEmail: String(formData.get("partnerEmail") ?? "").trim(), ownEmail: user.email, existingCategories: listPlayedCategories(getDb(), user.id), entryClosesAt: tournament.entryClosesAt, tournamentStatus: tournament.status });
      if (!validation.ok) return { error: validation.error };
    }
  }

  upsertProfile(getDb(), user.id, {
    fullName,
    dateOfBirth,
    gender,
    mobile,
    club: club || null,
    bestRanking: bestRanking || null,
    previousTournaments,
    plays: plays ?? null,
  });

  if (registering) return submitEntry({ error: null }, formData);
  redirect("/home");
}

function parsePreviousTournaments(raw: string): PreviousTournament[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (row): row is { name: string; year: number; result: string } =>
          typeof row === "object" &&
          row !== null &&
          typeof (row as { name?: unknown }).name === "string" &&
          (row as { name: string }).name.trim() !== "" &&
          typeof (row as { year?: unknown }).year === "number" &&
          typeof (row as { result?: unknown }).result === "string",
      )
      .map((row) => ({
        name: row.name.trim(),
        year: row.year,
        result: row.result.trim(),
      }));
  } catch {
    return [];
  }
}
