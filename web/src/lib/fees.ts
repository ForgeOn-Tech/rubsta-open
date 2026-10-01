import { CATEGORIES, type Category } from "@/db/schema";

import { formatFee } from "@/lib/format";

/** Each event's entry fee in paise. */
export type EventFees = Record<Category, number>;

/** Players in a team for each event: the doubles fee is split between two. */
const DOUBLES_TEAM_SIZE = 2;

/** "₹2,000–₹4,000", or one amount when every event costs the same. */
export function feeRangeLabel(fees: EventFees, currency: string): string {
  const amounts = CATEGORIES.map((category) => fees[category]);
  const lowest = Math.min(...amounts);
  const highest = Math.max(...amounts);
  if (lowest === highest) return formatFee(lowest, currency);
  return `${formatFee(lowest, currency)}–${formatFee(highest, currency)}`;
}

/** "₹4,000 per team (₹2,000 each)" for doubles; the plain fee for singles. */
export function eventFeeLabel(feeCents: number, currency: string, doubles: boolean): string {
  if (!doubles) return formatFee(feeCents, currency);
  const share = formatFee(feeCents / DOUBLES_TEAM_SIZE, currency);
  return `${formatFee(feeCents, currency)} per team (${share} each)`;
}
