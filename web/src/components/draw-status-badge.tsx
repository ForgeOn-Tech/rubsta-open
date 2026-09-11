import { DRAW_STATUS_LABELS, type DrawStatus } from "@/db/schema";

const BADGE_CLASS: Record<DrawStatus, string> = {
  draft: "badge badge-submitted",
  published: "badge badge-paid",
};

/** Draft, published, or plain text when no draw exists yet. */
export function DrawStatusBadge({ status }: { status: DrawStatus | null }) {
  if (status === null) return <span className="text-[12px] text-dim">Not generated</span>;
  return <span className={BADGE_CLASS[status]}>{DRAW_STATUS_LABELS[status]}</span>;
}
