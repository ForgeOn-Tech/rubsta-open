import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { respondToInvitationAction } from "../actions";
import { PartnerResponse } from "./partner-response";
import { requireUser } from "@/auth/require";
import { PartnerStatusBadge } from "@/components/partner-status-badge";
import { StatusBadge } from "@/components/status-badge";
import { getDb } from "@/db/client";
import { getPartnerInvitation } from "@/db/partners";
import { profiles } from "@/db/schema";
import { CATEGORY_LABELS, entryReference } from "@/lib/entries";
import { normaliseEmail } from "@/lib/partners";

export const dynamic = "force-dynamic";

/** Where an invited doubles partner accepts or declines. */
export default async function PartnerInvitationPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const user = await requireUser();
  const { entryId } = await params;
  const database = getDb();

  const invitation = getPartnerInvitation(database, entryId);
  // Only the invited email sees the invitation. Anyone else gets a 404, as for another player's entry.
  if (!invitation || invitation.entry.partnerEmail !== normaliseEmail(user.email)) notFound();

  const { entry, tournament, inviterName } = invitation;
  const partnerStatus = entry.partnerStatus;
  if (partnerStatus === null) notFound();
  const categoryLabel = CATEGORY_LABELS[entry.category];
  const hasProfile =
    database.select({ id: profiles.id }).from(profiles).where(eq(profiles.userId, user.id)).get() !==
    undefined;
  const open = partnerStatus === "pending" && entry.status !== "cancelled";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="eyebrow">{tournament.name} · Doubles partner</div>
        <h1 className="mt-2 text-[20px] font-semibold tracking-[-0.01em]">
          {inviterName} wants you as their {categoryLabel} partner
        </h1>
        <p className="mt-1.5 text-[13px] text-muted">
          {partnerStatus === "accepted"
            ? `You are playing ${categoryLabel} with ${inviterName}.`
            : partnerStatus === "declined"
              ? "You declined this invitation."
              : entry.status === "cancelled"
                ? "This entry was cancelled, so there is nothing to answer."
                : "Accept to join the entry. The entry goes into the draw once you accept."}
        </p>
      </div>

      <dl className="card divide-y divide-line">
        {[
          { label: "Event", value: `${categoryLabel} · Main draw` },
          { label: "Player", value: inviterName },
          { label: "Partner", value: <PartnerStatusBadge status={partnerStatus} /> },
          { label: "Entry", value: <StatusBadge status={entry.status} /> },
          { label: "Reference", value: <span className="mono">{entryReference(entry.id)}</span> },
        ].map((detail) => (
          <div key={detail.label} className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="caps">{detail.label}</dt>
            <dd className="m-0 text-right text-[13px]">{detail.value}</dd>
          </div>
        ))}
      </dl>

      {open && !hasProfile ? (
        <p className="card p-4 text-[13px] text-muted" role="status">
          Create your <Link href="/profile">player profile</Link> before you accept. You can decline without one.
        </p>
      ) : null}
      {open ? <PartnerResponse entryId={entry.id} action={respondToInvitationAction} /> : null}

      <Link href="/home" className="caps w-fit">
        Back to home
      </Link>
    </div>
  );
}
