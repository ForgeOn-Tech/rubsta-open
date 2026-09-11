/** Format a fee in cents as a currency string, e.g. ₹1,500. */
export function formatFee(feeCents: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(feeCents / 100);
}

/** e.g. "22 Sep, 18:00" — entry-close copy from an ISO datetime with offset. */
export function formatEntryCloses(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  }).format(date);
}

/** e.g. "11 Sep 2026, 09:30" — entry timestamps in the organiser table. */
export function formatEntryTime(epochMs: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  }).format(new Date(epochMs));
}

/** e.g. "22 Sep 2026" for the success screen. */
export function formatDate(epochMs: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(epochMs));
}
