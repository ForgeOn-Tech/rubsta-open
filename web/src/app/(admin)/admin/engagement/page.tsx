import Link from "next/link";
import { requireAdmin } from "@/auth/require";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminRefresh } from "@/components/admin-refresh";
import { getCurrentTournament } from "@/db/queries";
import { listDrawsWithSlots } from "@/db/draws";
import { getDb } from "@/db/client";
import { CATEGORY_LABELS } from "@/db/schema";

export default async function EngagementPage() {
  await requireAdmin();
  const tournament = getCurrentTournament();
  const published = tournament ? listDrawsWithSlots(getDb(), tournament.id).filter(({ draw }) => draw.status === "published") : [];
  return <>
    <AdminPageHeader eyebrow="Tournament OS · Team" title="Fan engagement" stats={[`${published.length} public draws`, "Engagement simulation available"]}><AdminRefresh /><Link className="btn btn-outline h-8 text-xs" href="/fan?demo=1#fan-engagement">Try engagement demo</Link></AdminPageHeader>
    <div className="space-y-6 p-6">
      <section className="card p-5"><h2 className="text-base font-semibold">What fans can see</h2><p className="mt-3 text-sm leading-6 text-muted">The fan app shows published draws and player names. Fans can search and save favourites on their device. Draft draws and player contact details stay private.</p>
        <ul className="mt-4 flex flex-wrap gap-3">{published.map(({ draw }) => <li key={draw.id}><Link className="badge" href={`/admin/draws/${draw.category}`}>{CATEGORY_LABELS[draw.category]}</Link></li>)}</ul>
        {!published.length && <p className="mt-3 text-sm text-muted">No published draws are visible to fans yet.</p>}
        <Link className="mt-4 inline-block text-sm" href="/fan">Open public fan app →</Link>
      </section>
      <section aria-labelledby="engagement-status"><h2 className="thead" id="engagement-status">Activity availability</h2><div className="mt-3 grid gap-4 sm:grid-cols-2">{[
        ["Predictions & leaderboard", "Demo only", "Test locked predictions, result settlement and points. No shared predictions or leaderboard are stored yet."],
        ["Reactions", "Demo only", "Fans can try reactions in the demo. Shared reaction totals and audience counts are not collected."],
        ["Court chat", "Demo only", "Messages stay in the demo page. There is no shared chat feed or moderation queue yet."],
        ["Favourites", "Device only", "Favourites work in the fan app, but are stored on the fan’s device. Team-wide follower counts are unavailable."],
      ].map(([title, status, copy]) => <article key={title} className="card p-5"><div className="flex justify-between gap-3"><h3 className="text-sm font-semibold">{title}</h3><span className="badge">{status}</span></div><p className="mt-4 text-xs leading-6 text-muted">{copy}</p></article>)}</div></section>
      <p className="card p-5 text-sm leading-6">To monitor real fan activity here, the fan app needs shared storage, match events and chat moderation. The demo does not feed this dashboard; unavailable metrics are not presented as zero activity.</p>
    </div>
  </>;
}
