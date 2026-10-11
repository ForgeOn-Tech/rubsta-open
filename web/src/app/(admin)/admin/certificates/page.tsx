import Link from "next/link";
import { requireAdmin } from "@/auth/require";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminNotice } from "@/components/admin-notice";
import { getCurrentTournament } from "@/db/queries";
import { listAdminCertificates } from "@/db/certificates";
import { CERTIFICATE_TITLES } from "@/lib/certificates";
import { CATEGORY_LABELS } from "@/lib/entries";

export const dynamic = "force-dynamic";

export default async function AdminCertificatesPage({ searchParams }: { searchParams: Promise<{ q?: string; kind?: string }> }) {
  await requireAdmin();
  const tournament = getCurrentTournament();
  if (!tournament) return <AdminNotice message="No tournament has been set up." />;
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const kind = params.kind === "winner" || params.kind === "participation" ? params.kind : "";
  const certificates = listAdminCertificates(tournament.id);
  const visible = certificates.filter(row => (!kind || row.kind === kind)
    && `${row.name} ${row.email} ${CATEGORY_LABELS[row.category]}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <AdminPageHeader eyebrow={`${tournament.name} · Certificates`} title="Certificates"
      stats={[`${certificates.length} certificates`, `Winners: ${certificates.filter(row => row.kind === "winner").length}`]} />
    <div className="flex flex-col gap-5 p-6">
      <p className="max-w-2xl text-[13px] text-muted">Download the same certificates available to players. Participation certificates appear after a completed scored match; winner certificates appear when the final result is confirmed. Each registered doubles partner has their own certificate.</p>
      <form role="search" action="/admin/certificates" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
        <label className="min-w-0 text-[12px]">Search players or events<input name="q" type="search" defaultValue={query} className="field w-full" placeholder="Name, email or event" /></label>
        <label className="text-[12px]">Certificate type<select name="kind" defaultValue={kind} className="field"><option value="">All certificates</option><option value="participation">Participation</option><option value="winner">Winner</option></select></label>
        <button className="btn btn-outline justify-self-start" type="submit">Search</button>
        {query || kind ? <Link href="/admin/certificates" className="py-2 text-[12px] underline">Clear filters</Link> : null}
      </form>
      {visible.length === 0 ? <p role="status" className="card p-5 text-[13px]">{certificates.length ? "No certificates match these filters." : "No certificates earned yet. Complete a scored match to make participation certificates available."}</p> : <>
        <p role="status" className="text-[12px] text-muted">Showing {visible.length} of {certificates.length} certificates.</p>
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map(row => <article key={`${row.userId}-${row.entryId}-${row.kind}`} aria-label={`${row.name} · ${CERTIFICATE_TITLES[row.kind]}`} className="card flex min-w-0 flex-col items-start gap-3 p-5">
            <h2 className="text-[16px] font-semibold">{row.name}</h2>
            <p className="break-all text-[12px] text-muted">{row.email}</p>
            <p className="text-[13px]">{CATEGORY_LABELS[row.category]} · {CERTIFICATE_TITLES[row.kind]}</p>
            <a href={`/api/admin/certificates/${encodeURIComponent(row.userId)}/${encodeURIComponent(row.entryId)}/${row.kind}`} download className="btn btn-primary" style={{ color: "var(--color-accent-fg)" }}>Download PDF</a>
          </article>)}
        </div>
      </>}
    </div>
  </>;
}
