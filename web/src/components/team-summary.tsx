import Link from "next/link";
import type { Entry } from "@/db/schema";
import { paymentSummary } from "@/lib/team-dashboard";

export function TeamSummary({ entries, published, draft, scheduleConfirmed }: {
  entries: Entry[]; published: number; draft: number; scheduleConfirmed: boolean;
}) {
  const payments = paymentSummary(entries);
  const pending = entries.filter((entry) => entry.status === "submitted").length;
  const cards = [
    { title: "Registrations", value: `${pending} to review`, note: `${new Set(entries.filter((entry) => entry.status !== "cancelled").map((entry) => entry.userId)).size} active players`, href: "/admin/entries?status=submitted" },
    { title: "Payments", value: `${payments.paid} marked paid`, note: `${payments.needsReview} records need reconciliation`, href: "/admin/payments" },
    { title: "Match operations", value: `${published} draws published`, note: `${draft} drafts · ${scheduleConfirmed ? "Schedule confirmed" : "Schedule needs confirmation"}`, href: "/admin/operations" },
    { title: "Fan engagement", value: "Demo available", note: "Shared fan activity is not connected", href: "/admin/engagement" },
  ];
  return <section aria-labelledby="team-heading">
    <h2 id="team-heading" className="thead">Team dashboard</h2>
    <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <Link className="card block p-4 hover:bg-surface-2" key={card.title} href={card.href}>
      <span className="caps">{card.title}</span><strong className="mt-3 block text-lg text-ink">{card.value}</strong><span className="mt-2 block text-xs leading-5 text-muted">{card.note}</span>
    </Link>)}</div>
    <div className="card mt-4 flex flex-wrap gap-x-6 gap-y-2 p-4 text-xs">
      <span className="font-semibold">Needs attention</span>
      {pending > 0 && <Link href="/admin/entries?status=submitted">Review {pending} submitted entries →</Link>}
      {payments.needsReview > 0 && <Link href="/admin/payments">Reconcile {payments.needsReview} payment records →</Link>}
      {!scheduleConfirmed && <Link href="/admin/settings">Confirm tournament details →</Link>}
      {draft > 0 && <Link href="/admin/operations">Check {draft} draft draws →</Link>}
      {pending === 0 && payments.needsReview === 0 && scheduleConfirmed && draft === 0 && <span>No outstanding registration, payment-record or draft-draw checks.</span>}
    </div>
  </section>;
}
