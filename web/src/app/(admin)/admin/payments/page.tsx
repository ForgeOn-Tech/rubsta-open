import Link from "next/link";
import { requireAdmin } from "@/auth/require";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminNotice } from "@/components/admin-notice";
import { AdminRefresh } from "@/components/admin-refresh";
import { StatusBadge } from "@/components/status-badge";
import { getCurrentTournament, listTournamentEntries } from "@/db/queries";
import { CATEGORY_LABELS } from "@/db/schema";
import { playerName, parseCategoryFilter, entriesHref } from "@/lib/admin-entries";
import { paymentSummary, paymentSource, PAYMENT_SOURCES, PAYMENT_SOURCE_LABELS } from "@/lib/team-dashboard";

export default async function PaymentsPage({ searchParams }: {
  searchParams: Promise<{ source?: string; category?: string; q?: string }>;
}) {
  await requireAdmin();
  const tournament = getCurrentTournament();
  if (!tournament) return <AdminNotice message="No tournament has been set up." />;
  const params = await searchParams;
  const category = parseCategoryFilter(params.category);
  const source = PAYMENT_SOURCES.find((value) => value === params.source);
  const query = (params.q ?? "").trim().toLowerCase();
  const all = listTournamentEntries(tournament.id);
  const summary = paymentSummary(all.map((row) => row.entry));
  const rows = all.filter((row) => (!category || row.entry.category === category)
    && (!source || paymentSource(row.entry) === source)
    && (!query || `${playerName(row)} ${row.email} ${row.entry.paymentRef ?? ""}`.toLowerCase().includes(query)));
  return <>
    <AdminPageHeader eyebrow={`${tournament.name} · Team`} title="Payments" stats={[`${summary.paid} marked paid`, `${summary.awaiting} confirmed, awaiting payment`, `${summary.needsReview} to reconcile`]}><AdminRefresh /><Link className="btn btn-outline h-8 text-xs" href="/admin/entries/export">Export entry records</Link></AdminPageHeader>
    <div className="space-y-5 p-6">
      <p className="card p-4 text-sm leading-6">These are payment references and entry statuses from this app’s database. Gateway settlements, charged amounts and refunds are not connected to this view. A reference alone does not verify a payment; demo and manual records are identified below.</p>
      {summary.cancelledWithReference > 0 && <p className="border border-warn p-4 text-sm text-warn">{summary.cancelledWithReference} cancelled entries retain a payment reference. Check refund status with the payment provider.</p>}
      <form className="card grid items-end gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4" method="get">
        <label className="text-xs">Player, email or reference<input className="field" name="q" defaultValue={params.q} placeholder="Search records" /></label>
        <label className="text-xs">Payment source<select className="field" name="source" defaultValue={source ?? ""}><option value="">All sources</option>{PAYMENT_SOURCES.map((item) => <option key={item} value={item}>{PAYMENT_SOURCE_LABELS[item]}</option>)}</select></label>
        <label className="text-xs">Event<select className="field" name="category" defaultValue={category ?? ""}><option value="">All events</option>{Object.entries(CATEGORY_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <div className="flex items-center gap-4"><button className="btn btn-primary" type="submit">Apply filters</button><Link href="/admin/payments">Clear</Link></div>
      </form>
      <div className="flex flex-wrap gap-4 text-xs"><span>{rows.length} matching records</span><Link href={entriesHref("/admin/entries", { status: "paid", category })}>View paid entries →</Link><Link href={entriesHref("/admin/entries", { status: "confirmed", category })}>Follow up confirmed entries →</Link></div>
      <div className="card overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-line">{["Player", "Event", "Entry status", "Payment source", "Reference", "Action"].map((label) => <th key={label} scope="col" className="thead p-4">{label}</th>)}</tr></thead><tbody>
        {rows.map((row) => <tr key={row.entry.id} className="border-b border-line"><td className="p-4"><strong className="font-medium">{playerName(row)}</strong><span className="mt-1 block text-xs text-muted">{row.email}</span></td><td className="p-4">{CATEGORY_LABELS[row.entry.category]}</td><td className="p-4"><StatusBadge status={row.entry.status} /></td><td className="p-4">{PAYMENT_SOURCE_LABELS[paymentSource(row.entry)]}</td><td className="max-w-64 break-all p-4 font-mono text-xs">{row.entry.paymentRef || "—"}</td><td className="p-4"><Link href={`/admin/entries/${row.entry.id}`}>Review entry →</Link></td></tr>)}
        {!rows.length && <tr><td colSpan={6} className="p-8 text-center text-muted">No payment records match these filters.</td></tr>}
      </tbody></table></div>
    </div>
  </>;
}
