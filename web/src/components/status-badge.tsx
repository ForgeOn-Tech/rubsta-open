import { ENTRY_STATUS_LABELS, type EntryStatus } from "@/db/schema";

export function StatusBadge({ status }: { status: EntryStatus }) {
  return <span className={`badge badge-${status}`}>{ENTRY_STATUS_LABELS[status]}</span>;
}
