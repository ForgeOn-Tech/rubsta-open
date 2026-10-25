"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { auth } from "@/auth/auth";
import { getDb } from "@/db/client";
import { saveFeedback } from "@/db/feedback";
import { getCurrentTournament } from "@/db/queries";
import { FeedbackError, type FeedbackInput, parseFeedback } from "@/lib/feedback";
import type { ActionState } from "@/lib/form-state";

import { VISITOR_COOKIE } from "./visitor-cookie";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function readFeedback(form: FormData): FeedbackInput {
  return parseFeedback((name) => {
    const value = form.get(name);
    return typeof value === "string" ? value : null;
  });
}

/** Saves the sender's ratings. A visitor's browser keeps the response id, so a resend replaces it. */
export async function sendFeedback(_previous: ActionState, form: FormData): Promise<ActionState> {
  const tournament = getCurrentTournament();
  if (!tournament) return { error: "Feedback is not open yet.", savedAt: null };

  let input: FeedbackInput;
  try {
    input = readFeedback(form);
  } catch (error) {
    if (error instanceof FeedbackError) return { error: error.message, savedAt: null };
    throw error;
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const store = await cookies();
  const sender = userId === null
    ? { visitorResponseId: store.get(VISITOR_COOKIE)?.value ?? null }
    : { userId };
  const id = saveFeedback(getDb(), tournament.id, sender, input, Date.now());
  if (userId === null) {
    store.set(VISITOR_COOKIE, id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/feedback",
      maxAge: ONE_YEAR_SECONDS,
    });
  }
  revalidatePath("/admin/feedback");
  return { error: null, savedAt: Date.now() };
}
