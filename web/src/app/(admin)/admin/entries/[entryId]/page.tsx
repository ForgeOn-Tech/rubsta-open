import Link from "next/link";
import { notFound } from "next/navigation";

import { changeEntryStatus } from "../actions";
import { EntryStatusActions } from "../entry-status-actions";
import { requireAdmin } from "@/auth/require";
import { AdminPageHeader } from "@/components/admin-page-header";
import { StatusBadge } from "@/components/status-badge";
import { getAdminEntry } from "@/db/queries";
import { ENTRY_STATUS_LABELS, GENDER_LABELS } from "@/db/schema";
import { ADMIN_ENTRIES_PATH, playerName } from "@/lib/admin-entries";
import { ageFromDob } from "@/lib/age";
import { CATEGORY_LABELS, entryReference } from "@/lib/entries";
import { formatEntryTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const EMPTY_VALUE = "—";

interface Detail {
  label: string;
  value: React.ReactNode;
}

export default async function AdminEntryPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  await requireAdmin();
  const { entryId } = await params;

  const row = getAdminEntry(entryId);
  if (!row) notFound();

  const { entry, email, profile, tournament } = row;
  const name = playerName(row);
  const eventLabel = CATEGORY_LABELS[entry.category];
  const age = profile ? ageFromDob(profile.dateOfBirth) : null;

  const player: Detail[] = [
    { label: "Email", value: email },
    { label: "Mobile", value: profile?.mobile ?? EMPTY_VALUE },
    {
      label: "Date of birth",
      value: profile
        ? `${profile.dateOfBirth}${age === null ? "" : ` · age ${age}`}`
        : EMPTY_VALUE,
    },
    { label: "Gender", value: profile ? GENDER_LABELS[profile.gender] : EMPTY_VALUE },
    { label: "Club", value: profile?.club ?? EMPTY_VALUE },
    { label: "Best ranking", value: profile?.bestRanking ?? EMPTY_VALUE },
  ];
  const entryDetails: Detail[] = [
    { label: "Event", value: `${eventLabel} · Main draw` },
    {
      label: "Partner",
      value: entry.partnerName ? `${entry.partnerName} · ${entry.partnerEmail}` : EMPTY_VALUE,
    },
    { label: "Status", value: <StatusBadge status={entry.status} /> },
    { label: "Payment reference", value: entry.paymentRef ?? EMPTY_VALUE },
    { label: "Submitted", value: `${formatEntryTime(entry.createdAt)} IST` },
    { label: "Reference", value: entryReference(entry.id) },
  ];

  return (
    <>
      <AdminPageHeader
        eyebrow={`${tournament.name} · Entry`}
        title={name}
        stats={[eventLabel, ENTRY_STATUS_LABELS[entry.status], `Ref ${entryReference(entry.id)}`]}
      >
        <Link href={ADMIN_ENTRIES_PATH} className="btn btn-outline h-8 text-[12px]">
          All entries
        </Link>
      </AdminPageHeader>

      <div className="grid gap-5 p-6 lg:grid-cols-2">
        <DetailCard id="player-heading" title="Player" details={player} />
        <DetailCard id="entry-heading" title="Entry" details={entryDetails} />

        <section aria-labelledby="actions-heading" className="card p-4 lg:col-span-2">
          <h2 id="actions-heading" className="thead">
            Change status
          </h2>
          <div className="mt-3">
            <EntryStatusActions
              entryId={entry.id}
              status={entry.status}
              subject={`${name}, ${eventLabel}`}
              action={changeEntryStatus}
            />
          </div>
        </section>

        {profile && profile.previousTournaments.length > 0 ? (
          <section aria-labelledby="history-heading" className="card lg:col-span-2">
            <h2 id="history-heading" className="thead px-4 pt-4">
              Previous tournaments
            </h2>
            <ul className="mt-2 divide-y divide-line">
              {profile.previousTournaments.map((past, index) => (
                <li
                  key={`${past.name}-${past.year}-${index}`}
                  className="flex items-center justify-between gap-4 px-4 py-2.5 text-[13px]"
                >
                  <span>
                    {past.name} <span className="mono text-[11px] text-dim">{past.year}</span>
                  </span>
                  <span className="text-muted">{past.result || EMPTY_VALUE}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}

function DetailCard({ id, title, details }: { id: string; title: string; details: Detail[] }) {
  return (
    <section aria-labelledby={id} className="card">
      <h2 id={id} className="thead px-4 pt-4">
        {title}
      </h2>
      <dl className="mt-2 divide-y divide-line">
        {details.map((detail) => (
          <div key={detail.label} className="flex items-center justify-between gap-4 px-4 py-2.5">
            <dt className="caps">{detail.label}</dt>
            <dd className="m-0 text-right text-[13px]">{detail.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
