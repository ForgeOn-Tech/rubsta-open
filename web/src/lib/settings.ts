import {
  CATEGORIES,
  CATEGORY_LABELS,
  TOURNAMENT_STATUSES,
  type Category,
  type TournamentStatus,
} from "@/db/schema";
import type { EventFees } from "@/lib/fees";
import type { ActionState } from "@/lib/form-state";

const IST_OFFSET = "+05:30";
const IST_TIME_ZONE = "Asia/Kolkata";
const MAX_NAME_LENGTH = 120;
const MAX_VENUE_LENGTH = 160;
const MAX_FEE_RUPEES = 1_000_000;
const PAISE_PER_RUPEE = 100;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const WHOLE_NUMBER = /^\d+$/;
const LAST_HOUR = 23;
const LAST_MINUTE = 59;

/** Raw values from the settings form. */
export interface SettingsForm {
  name: string;
  startsOn: string;
  endsOn: string;
  venue: string;
  entryClosesAt: string; // datetime-local, entered in IST
  feeRupees: Record<Category, string>;
  status: string;
  scheduleConfirmed: boolean;
}

/** Validated values, shaped for the tournaments table. */
export interface TournamentSettings {
  name: string;
  startsOn: string | null;
  endsOn: string | null;
  venue: string | null;
  entryClosesAt: string;
  status: TournamentStatus;
  scheduleConfirmed: boolean;
}

export type SettingsValidation =
  | { ok: true; settings: TournamentSettings; fees: EventFees }
  | { ok: false; error: string };

export type SettingsFormState = ActionState;

/** A real YYYY-MM-DD date (rejects 2026-02-30). */
export function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** "2026-09-22T18:00" entered in IST → "2026-09-22T18:00:00+05:30"; null when invalid. */
export function istLocalToIso(value: string): string | null {
  if (!DATE_TIME_LOCAL_PATTERN.test(value) || !isCalendarDate(value.slice(0, 10))) return null;
  const [hours, minutes] = value.slice(11).split(":").map(Number);
  if (hours > LAST_HOUR || minutes > LAST_MINUTE) return null;
  return `${value}:00${IST_OFFSET}`;
}

/** Stored ISO time → "YYYY-MM-DDTHH:mm" in IST, for a datetime-local input. */
export function isoToIstLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid tournament time: "${iso}"`);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: IST_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Each event's fee in paise, or the first error in the form's rupee amounts. */
function validateFees(feeRupees: Record<Category, string>): EventFees | string {
  const fees: Partial<EventFees> = {};
  for (const category of CATEGORIES) {
    const text = feeRupees[category].trim();
    const label = CATEGORY_LABELS[category];
    if (!WHOLE_NUMBER.test(text)) return `Enter the ${label} fee in whole rupees.`;
    const rupees = Number(text);
    if (rupees > MAX_FEE_RUPEES) return `The ${label} fee is too large.`;
    fees[category] = rupees * PAISE_PER_RUPEE;
  }
  return fees as EventFees;
}

function fail(error: string): SettingsValidation {
  return { ok: false, error };
}

export function validateSettings(form: SettingsForm): SettingsValidation {
  const name = form.name.trim();
  if (!name) return fail("Tournament name is required.");
  if (name.length > MAX_NAME_LENGTH) {
    return fail(`Keep the name to ${MAX_NAME_LENGTH} characters or fewer.`);
  }

  const startsOn = form.startsOn.trim() || null;
  const endsOn = form.endsOn.trim() || null;
  if (startsOn && !isCalendarDate(startsOn)) return fail("Enter a valid start date.");
  if (endsOn && !isCalendarDate(endsOn)) return fail("Enter a valid end date.");
  if (endsOn && !startsOn) return fail("Add a start date before an end date.");
  if (startsOn && endsOn && endsOn < startsOn) {
    return fail("The end date must be on or after the start date.");
  }

  const venue = form.venue.trim() || null;
  if (venue && venue.length > MAX_VENUE_LENGTH) {
    return fail(`Keep the venue to ${MAX_VENUE_LENGTH} characters or fewer.`);
  }

  const entryClosesAt = istLocalToIso(form.entryClosesAt.trim());
  if (!entryClosesAt) return fail("Enter a valid entry closing time.");
  // The stored value is IST wall time, so its first 10 characters are the IST date.
  if (startsOn && entryClosesAt.slice(0, 10) > startsOn) {
    return fail("Entries must close on or before the start date.");
  }

  const fees = validateFees(form.feeRupees);
  if (typeof fees === "string") return fail(fees);

  const status = TOURNAMENT_STATUSES.find((value) => value === form.status);
  if (!status) return fail("Choose whether entries are open or closed.");

  if (form.scheduleConfirmed && (!startsOn || !venue)) {
    return fail("Add a start date and venue before confirming the schedule.");
  }

  return {
    ok: true,
    settings: {
      name,
      startsOn,
      endsOn,
      venue,
      entryClosesAt,
      status,
      scheduleConfirmed: form.scheduleConfirmed,
    },
    fees,
  };
}
