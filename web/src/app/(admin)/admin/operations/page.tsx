import Link from "next/link";
import { requireAdmin } from "@/auth/require";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminNotice } from "@/components/admin-notice";
import { AdminRefresh } from "@/components/admin-refresh";
import { getCurrentTournament, listTournamentEntries } from "@/db/queries";
import { listDrawsWithSlots } from "@/db/draws";
import { getDb } from "@/db/client";
import { CATEGORIES, CATEGORY_LABELS } from "@/db/schema";
import { canDraw, eligibleRows, toDrawEntrant, drawChanges, hasDrawChanges, describeDrawChanges } from "@/lib/draws";
import { formatTournamentDates } from "@/lib/format";

export default async function OperationsPage() {
  await requireAdmin();
  const tournament = getCurrentTournament();
  if (!tournament) return <AdminNotice message="No tournament has been set up." />;
  const rows = listTournamentEntries(tournament.id);
  const draws = listDrawsWithSlots(getDb(), tournament.id);
  return <>
    <AdminPageHeader eyebrow={`${tournament.name} · Team`} title="Match operations" stats={[`${draws.filter(({ draw }) => draw.status === "published").length} published draws`, tournament.scheduleConfirmed ? "Tournament details confirmed" : "Tournament details provisional"]}><AdminRefresh /><Link className="btn btn-outline h-8 text-xs" href="/fan">Open fan view</Link></AdminPageHeader>
    <div className="space-y-6 p-6">
      <section className="card p-5"><h2 className="thead">Tournament setup</h2><p className="mt-3 text-sm">{formatTournamentDates(tournament.startsOn, tournament.endsOn) || "Dates not set"} · {tournament.venue || "Venue not set"}</p><Link href="/admin/settings" className="mt-3 inline-block text-xs">Manage tournament settings →</Link></section>
      <section aria-labelledby="readiness-title"><h2 id="readiness-title" className="thead">Draw readiness</h2><div className="mt-3 grid gap-4 lg:grid-cols-2">
        {CATEGORIES.map((category) => {
          const accepted = eligibleRows(rows, category).map(toDrawEntrant);
          const existing = draws.find(({ draw }) => draw.category === category);
          const changes = existing ? drawChanges(existing.slots, accepted) : null;
          const stale = changes && hasDrawChanges(changes);
          return <article className="card p-5" key={category}><div className="flex justify-between gap-3"><h3 className="text-sm font-semibold">{CATEGORY_LABELS[category]}</h3><span className="badge">{existing?.draw.status ?? "Not generated"}</span></div>
            <p className="mt-4 text-sm">{accepted.length} accepted entries{existing ? ` · ${existing.draw.size}-line draw` : ""}</p>
            <p className="mt-2 text-xs leading-5 text-muted">{existing?.draw.status === "published" ? "Visible to fans. Return to draft before changing this draw." : existing ? "Draft only. Review the bracket before publishing." : canDraw(accepted.length) ? "Ready to seed and generate a draw." : "A draw requires 2–128 accepted entries."}</p>
            {stale && <p className="mt-3 text-xs leading-5 text-warn">{describeDrawChanges(changes)} Review the draw before play.</p>}
            <Link className="mt-4 inline-block text-xs" href={`/admin/draws/${category}`}>Manage draw →</Link>
          </article>;
        })}
      </div></section>
      <section className="card p-5"><h2 className="thead">Matchday connections</h2><dl className="mt-4 grid gap-5 text-sm sm:grid-cols-3">{["Court allocation & order of play", "Live scoring", "Results & certificates"].map((title) => <div key={title}><dt className="font-medium">{title}</dt><dd className="mt-2 text-xs leading-5 text-muted">Not connected to this dashboard yet.</dd></div>)}</dl></section>
    </div>
  </>;
}
