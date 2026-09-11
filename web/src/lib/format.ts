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

/** A count with the right noun form, e.g. "1 entry", "3 entries". */
export function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function calendarDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Tournament dates from YYYY-MM-DD values, e.g. "25–27 Sept 2026" or
 * "30 Sept – 2 Oct 2026". Null without a start date.
 */
export function formatTournamentDates(startsOn: string | null, endsOn: string | null): string | null {
  if (!startsOn) return null;
  const start = calendarDate(startsOn);
  const end = calendarDate(endsOn ?? startsOn);
  if (start.getTime() === end.getTime()) return DAY_MONTH_YEAR.format(start);
  if (start.getUTCFullYear() !== end.getUTCFullYear()) {
    return `${DAY_MONTH_YEAR.format(start)} – ${DAY_MONTH_YEAR.format(end)}`;
  }
  if (start.getUTCMonth() !== end.getUTCMonth()) {
    return `${DAY_MONTH.format(start)} – ${DAY_MONTH_YEAR.format(end)}`;
  }
  return `${start.getUTCDate()}–${DAY_MONTH_YEAR.format(end)}`;
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
