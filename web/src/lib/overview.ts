import { CATEGORIES, CATEGORY_LABELS, type Category, type EntryStatus } from "@/db/schema";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const HOURS_BEFORE_DAYS = 48;

export interface EventSummary {
  category: Category;
  label: string;
  /** Entries that are not cancelled. */
  active: number;
  /** Submitted entries waiting for an organiser decision. */
  awaitingReview: number;
  /** Confirmed and paid entries: the ones a draw would include. */
  accepted: number;
}

/** One row per event, in category order, including events with no entries. */
export function summariseByEvent(
  rows: readonly { category: Category; status: EntryStatus }[],
): EventSummary[] {
  return CATEGORIES.map((category) => {
    const inEvent = rows.filter((row) => row.category === category);
    return {
      category,
      label: CATEGORY_LABELS[category],
      active: inEvent.filter((row) => row.status !== "cancelled").length,
      awaitingReview: inEvent.filter((row) => row.status === "submitted").length,
      accepted: inEvent.filter((row) => row.status === "confirmed" || row.status === "paid")
        .length,
    };
  });
}

/** e.g. "Closes in 11 days", "Closes in 5 hours", "Entries closed". */
export function timeToCloseLabel(entryClosesAt: string, now: Date): string {
  const closes = new Date(entryClosesAt).getTime();
  if (Number.isNaN(closes)) {
    throw new Error(`Invalid entry closing time: "${entryClosesAt}"`);
  }
  const remaining = closes - now.getTime();
  if (remaining <= 0) return "Entries closed";
  if (remaining < HOUR_MS) return "Closes in under an hour";
  if (remaining < HOURS_BEFORE_DAYS * HOUR_MS) {
    const hours = Math.floor(remaining / HOUR_MS);
    return `Closes in ${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  return `Closes in ${Math.floor(remaining / DAY_MS)} days`;
}
