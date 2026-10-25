import Link from "next/link";
import { cookies } from "next/headers";

import { auth } from "@/auth/auth";
import { getDb } from "@/db/client";
import { findOwnFeedback } from "@/db/feedback";
import { getCurrentTournament } from "@/db/queries";
import { signInPathFor } from "@/lib/sign-in-return";

import { FeedbackForm } from "./feedback-form";
import { VISITOR_COOKIE } from "./visitor-cookie";

export const dynamic = "force-dynamic";

const FEEDBACK_PATH = "/feedback";

/** Anyone can rate the tournament; a signed-in player's answers count once and can be changed. */
export default async function FeedbackPage() {
  const tournament = getCurrentTournament();
  if (!tournament) return <p>Feedback is not open yet.</p>;

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const store = await cookies();
  const sender = userId === null
    ? { visitorResponseId: store.get(VISITOR_COOKIE)?.value ?? null }
    : { userId };
  const previous = findOwnFeedback(getDb(), tournament.id, sender);

  return <div className="max-w-2xl">
    <p className="text-xs uppercase tracking-[2px]">Rubsta Open · Feedback</p>
    <h1 className="mt-4 font-serif text-5xl">How was Rubsta Open?</h1>
    <p className="mt-4 text-club-muted">
      Rate each part of the tournament from 1 to 5 stars. Choose &ldquo;Didn&rsquo;t use&rdquo; for anything you skipped.
    </p>
    {previous ? <p className="mt-3 text-sm">
      You sent feedback on {new Date(previous.updatedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long" })}.
      Change anything below and send it again.
    </p> : null}
    {userId === null ? <p className="mt-3 text-sm text-club-muted">
      Played in the tournament? <Link href={signInPathFor(FEEDBACK_PATH)} className="underline">Sign in</Link> first, so your answers count as a player&rsquo;s.
    </p> : null}
    <FeedbackForm initialRatings={previous?.ratings ?? {}} initialComment={previous?.comment ?? ""} />
  </div>;
}
