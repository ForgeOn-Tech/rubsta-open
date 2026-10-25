import Link from "next/link";

import { requireAdmin } from "@/auth/require";
import { AdminNotice } from "@/components/admin-notice";
import { AdminPageHeader } from "@/components/admin-page-header";
import { getDb } from "@/db/client";
import { listFeedback } from "@/db/feedback";
import { getCurrentTournament } from "@/db/queries";
import { FEEDBACK_OPENING_TEXT, MAX_STARS, isFeedbackOpen, summarizeFeedback } from "@/lib/feedback";

export const dynamic = "force-dynamic";

const WHEN = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
const STARS_HIGH_TO_LOW = Array.from({ length: MAX_STARS }, (_, index) => MAX_STARS - index);

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Averages per part of the tournament, then every comment. Responses carry no names. */
export default async function AdminFeedbackPage() {
  await requireAdmin();
  const tournament = getCurrentTournament();
  if (!tournament) return <AdminNotice message="No tournament has been set up." />;

  const responses = listFeedback(getDb(), tournament.id);
  const topics = summarizeFeedback(responses.map((response) => response.ratings));
  const fromPlayers = responses.filter((response) => response.fromPlayer).length;
  const comments = responses.filter((response) => response.comment !== null);

  return <>
    <AdminPageHeader eyebrow={`${tournament.name} · Feedback`} title="Feedback"
      stats={[isFeedbackOpen(new Date().getTime()) ? "Form open" : `Opens ${FEEDBACK_OPENING_TEXT}`, plural(responses.length, "response", "responses"), `Players: ${fromPlayers}`, `Visitors: ${responses.length - fromPlayers}`, plural(comments.length, "comment", "comments")]}>
      <Link href="/feedback" className="btn btn-outline">Open the form</Link>
    </AdminPageHeader>
    <div className="flex flex-col gap-5 p-6">
      <p className="max-w-2xl text-[13px] text-muted">
        Anyone can send feedback at www.rubstaopen.com/feedback. A signed-in player has one response and can change it.
        A visitor who sends again from the same browser replaces their earlier response. Names are not shown here.
      </p>

      {responses.length === 0 ? <p role="status" className="card p-5 text-[13px]">No feedback yet. Share the form link to start collecting ratings.</p> : <>
        <section aria-labelledby="feedback-ratings" className="flex flex-col gap-3">
          <h2 id="feedback-ratings" className="text-[16px] font-semibold">Ratings</h2>
          <div className="card divide-y divide-line">
          {topics.map((topic) => <div key={topic.key} className="grid gap-2 p-4 sm:grid-cols-[minmax(0,14rem)_5rem_minmax(0,1fr)] sm:items-center">
            <h3 className="text-[14px] font-semibold">{topic.label}</h3>
            <p className="text-[20px] font-semibold" aria-label={topic.average === null ? "Not rated" : `Average ${topic.average.toFixed(1)} out of ${MAX_STARS}`}>
              {topic.average === null ? "–" : `${topic.average.toFixed(1)} ★`}
            </p>
            <div className="min-w-0">
              <div className="h-2 w-full bg-surface-2" aria-hidden="true">
                <div className="h-2 bg-accent" style={{ width: `${((topic.average ?? 0) / MAX_STARS) * 100}%` }} />
              </div>
              <p className="mono mt-1.5 text-[11px] text-muted">
                {plural(topic.count, "rating", "ratings")}
                {topic.count > 0 ? ` · ${STARS_HIGH_TO_LOW.map((stars) => `${stars}★ ${topic.stars[stars - 1]}`).join(" · ")}` : ""}
              </p>
            </div>
          </div>)}
          </div>
        </section>

        <section aria-label="Comments" className="flex flex-col gap-3">
          <h2 className="text-[16px] font-semibold">Comments</h2>
          {comments.length === 0 ? <p className="text-[13px] text-muted">Nobody has left a comment yet.</p> : comments.map((response) => <article key={response.id} className="card p-4">
            <p className="mono text-[11px] uppercase text-muted">
              {response.fromPlayer ? "Player" : "Visitor"} · {WHEN.format(response.updatedAt)} IST
              {response.ratings.overall === undefined ? "" : ` · Overall ${response.ratings.overall}★`}
            </p>
            <p className="mt-2 whitespace-pre-line break-words text-[14px]">{response.comment}</p>
          </article>)}
        </section>
      </>}
    </div>
  </>;
}
