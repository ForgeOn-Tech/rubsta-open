import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { changePartnerAction } from "../actions";
import { ChangePartnerForm } from "./change-partner-form";
import { InviteLink } from "./invite-link";
import { PayButton } from "./pay-button";
import { confirmCheckout, startCheckout } from "./payment-actions";
import { requireUser } from "@/auth/require";
import { PartnerStatusBadge } from "@/components/partner-status-badge";
import { StatusBadge } from "@/components/status-badge";
import { db, getDb } from "@/db/client";
import { getEventFees } from "@/db/fees";
import { entries, tournaments } from "@/db/schema";
import { CATEGORY_LABELS, entryReference, isDoubles } from "@/lib/entries";
import { awaitsPayment } from "@/lib/entry-status";
import { eventFeeLabel } from "@/lib/fees";
import { formatDate, formatFee } from "@/lib/format";
import { partnerInvitationPath } from "@/lib/partners";
import { razorpayConfig } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

interface Detail {
  label: string;
  value: React.ReactNode;
}

export default async function EntryConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ entryId: string }>;
  searchParams: Promise<{ pay?: string }>;
}) {
  const user = await requireUser();
  const { entryId } = await params;
  const { pay } = await searchParams;

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
  const partnerStatus = entry.partnerStatus;
  const feeCents = getEventFees(getDb(), tournament.id)[entry.category];
  const feeLabel = eventFeeLabel(feeCents, tournament.currency, isDoubles(entry.category));
  const awaitingPayment = awaitsPayment({
    paymentsOn: razorpayConfig(process.env) !== null,
    feeCents,
    status: entry.status,
  });

  const partner: Detail[] = entry.partnerName
    ? [
        {
          label: "Partner",
          value: (
            <span className="flex flex-col items-end gap-1">
              {`${entry.partnerName} · ${entry.partnerEmail}`}
              {partnerStatus === null ? null : <PartnerStatusBadge status={partnerStatus} />}
            </span>
          ),
        },
      ]
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
          {feeLabel}
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
          {entryReference(entry.id)}
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
          {entry.status === "paid" ? "Entry paid" : awaitingPayment ? "Pay to complete your entry" : "Entry received"}
        </h1>
        <p className="mt-1.5 text-[13px] text-muted">
          {awaitingPayment
            ? `Your ${categoryLabel} entry for ${tournament.name} is saved. It is complete once the fee is paid.`
            : `Your ${categoryLabel} entry for ${tournament.name} is recorded.`}
        </p>
      </div>

      {awaitingPayment ? (
        <section aria-labelledby="payment-heading" className="card flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="payment-heading" className="text-[14px] font-semibold">
              Entry fee
            </h2>
            <span className="mono text-right text-[16px] font-semibold">{feeLabel}</span>
          </div>
          <p className="text-[12px] text-muted">Pay by UPI, card or netbanking through Razorpay.</p>
          <PayButton
            entryId={entry.id}
            amountLabel={formatFee(feeCents, tournament.currency)}
            openOnLoad={pay === "1"}
            start={startCheckout}
            confirm={confirmCheckout}
          />
        </section>
      ) : null}

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

      {(partnerStatus === "pending" || partnerStatus === "declined") && entry.status !== "cancelled" ? (
        <section aria-labelledby="partner-heading" className="card flex flex-col gap-4 p-4">
          <h2 id="partner-heading" className="text-[14px] font-semibold">
            {partnerStatus === "pending" ? "Your partner needs to accept" : "Your partner declined"}
          </h2>
          <p className="text-[13px] text-muted">
            {partnerStatus === "pending"
              ? `This entry goes into the draw once ${entry.partnerName} accepts. Send them this link. They sign in with ${entry.partnerEmail} to answer.`
              : `${entry.partnerName} declined. Name a new partner to keep this entry.`}
          </p>
          {partnerStatus === "pending" ? <InviteLink path={partnerInvitationPath(entry.id)} /> : null}
          <ChangePartnerForm entryId={entry.id} action={changePartnerAction} />
        </section>
      ) : null}

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
