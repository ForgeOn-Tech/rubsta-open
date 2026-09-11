import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/auth/require";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/db/client";
import { entries, tournaments } from "@/db/schema";
import { CATEGORY_LABELS } from "@/lib/entries";
import { formatDate, formatFee } from "@/lib/format";

export const dynamic = "force-dynamic";

const REFERENCE_LENGTH = 8;

interface Detail {
  label: string;
  value: React.ReactNode;
}

export default async function EntryConfirmationPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const user = await requireUser();
  const { entryId } = await params;

  // Scoped to the signed-in user: another player's entry id is a 404.
  const row = db
    .select({ entry: entries, tournament: tournaments })
    .from(entries)
    .innerJoin(tournaments, eq(entries.tournamentId, tournaments.id))
    .where(and(eq(entries.id, entryId), eq(entries.userId, user.id)))
    .get();
  if (!row) notFound();

  const { entry, tournament } = row;
  const categoryLabel = CATEGORY_LABELS[entry.category];

  const partner: Detail[] = entry.partnerName
    ? [{ label: "Partner", value: `${entry.partnerName} · ${entry.partnerEmail}` }]
    : [];
  const payment: Detail[] = entry.paymentRef
    ? [{ label: "Payment", value: <span className="mono">{entry.paymentRef}</span> }]
    : [];
  const details: Detail[] = [
    { label: "Event", value: `${categoryLabel} · Main draw` },
    ...partner,
    {
      label: "Entry fee",
      value: (
        <span className="mono">
          {formatFee(tournament.feeCents, tournament.currency)}
        </span>
      ),
    },
    { label: "Status", value: <StatusBadge status={entry.status} /> },
    {
      label: "Submitted",
      value: <span className="mono">{formatDate(entry.createdAt)}</span>,
    },
    {
      label: "Reference",
      value: (
        <span className="mono">
          {entry.id.slice(0, REFERENCE_LENGTH).toUpperCase()}
        </span>
      ),
    },
    ...payment,
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="eyebrow">{tournament.name} · Entry</div>
        <h1 className="mt-2 text-[20px] font-semibold tracking-[-0.01em]">
          {entry.status === "paid" ? "Entry paid" : "Entry received"}
        </h1>
        <p className="mt-1.5 text-[13px] text-muted">
          Your {categoryLabel} entry for {tournament.name} is recorded.
        </p>
      </div>

      <dl className="card divide-y divide-line">
        {details.map((detail) => (
          <div
            key={detail.label}
            className="flex items-center justify-between gap-4 px-4 py-3"
          >
            <dt className="caps">{detail.label}</dt>
            <dd className="m-0 text-right text-[13px]">{detail.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex items-center justify-between gap-3">
        <Link href="/home" className="caps">
          Back to home
        </Link>
        <Link href="/profile" className="caps">
          Edit profile
        </Link>
      </div>
    </div>
  );
}
