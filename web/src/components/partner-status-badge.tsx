import { PARTNER_STATUS_LABELS, type PartnerStatus } from "@/db/schema";

const BADGE_STYLES: Record<PartnerStatus, string> = {
  pending: "badge-submitted",
  accepted: "badge-confirmed",
  declined: "badge-cancelled",
};

export function PartnerStatusBadge({ status }: { status: PartnerStatus }) {
  return <span className={`badge ${BADGE_STYLES[status]}`}>{PARTNER_STATUS_LABELS[status]}</span>;
}
