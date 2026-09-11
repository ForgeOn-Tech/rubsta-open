import { ENTRY_STATUSES, type EntryStatus } from "@/db/schema";

export interface EntryAction {
  to: EntryStatus;
  label: string;
}

/** Recorded when an admin marks an entry paid outside the checkout. */
export const MANUAL_PAYMENT_REF = "manual";

const TRANSITIONS: Record<EntryStatus, readonly EntryAction[]> = {
  submitted: [
    { to: "confirmed", label: "Confirm" },
    { to: "cancelled", label: "Cancel" },
  ],
  confirmed: [
    { to: "paid", label: "Mark paid" },
    { to: "cancelled", label: "Cancel" },
  ],
  paid: [{ to: "cancelled", label: "Cancel" }],
  cancelled: [{ to: "submitted", label: "Reinstate" }],
};

export function isEntryStatus(value: string): value is EntryStatus {
  return ENTRY_STATUSES.some((status) => status === value);
}

/** The status changes an admin can make from `status`. */
export function actionsFor(status: EntryStatus): readonly EntryAction[] {
  return TRANSITIONS[status];
}

export function canTransition(from: EntryStatus, to: EntryStatus): boolean {
  return TRANSITIONS[from].some((action) => action.to === to);
}

/**
 * The fields to write for a status change. Marking paid keeps an existing
 * payment reference (e.g. the checkout stub) and otherwise records "manual".
 */
export function statusUpdate(
  entry: { status: EntryStatus; paymentRef: string | null },
  to: EntryStatus,
): { status: EntryStatus; paymentRef: string | null } {
  if (!canTransition(entry.status, to)) {
    throw new Error(`Cannot move an entry from ${entry.status} to ${to}.`);
  }
  return {
    status: to,
    paymentRef: to === "paid" ? (entry.paymentRef ?? MANUAL_PAYMENT_REF) : entry.paymentRef,
  };
}
