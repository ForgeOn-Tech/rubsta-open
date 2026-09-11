import {
  SCHEDULE_TIMINGS,
  type Court,
  type MatchStatus,
  type ScheduleItem,
  type ScheduleItemKind,
  type ScheduleTiming,
} from "@/db/schema";
import { MAX_COURT } from "@/lib/score-record";
import { isCalendarDate } from "@/lib/settings";

export const ADMIN_ORDER_OF_PLAY_PATH = "/admin/order-of-play";
export const MAX_SCHEDULE_DAYS = 31;
export const MAX_COURT_NAME_LENGTH = 40;
export const MAX_COURT_SURFACE_LENGTH = 40;
export const MAX_BLOCK_TITLE_LENGTH = 80;
export const MAX_BLOCK_NOTE_LENGTH = 120;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MS_PER_DAY = 86_400_000;
const DAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export const SCHEDULE_TIMING_LABELS: Record<ScheduleTiming, string> = {
  at: "Starts at",
  notBefore: "Not before",
  followOn: "After the item above",
};

export const SCHEDULE_STATUS_LABELS: Record<MatchStatus, string> = {
  scheduled: "To play",
  in_progress: "Live",
  completed: "Result in",
};

/** The fields of a schedule item that publishing copies for umpires. */
export interface ScheduleEntry {
  id: string;
  day: string;
  courtNumber: number;
  position: number;
  kind: ScheduleItemKind;
  matchId: string | null;
  title: string | null;
  note: string | null;
  timing: ScheduleTiming;
  time: string | null;
  endTime: string | null;
  umpireEmail: string | null;
}

export interface CourtFields {
  name: string | null;
  surface: string | null;
}

export interface BlockFields {
  title: string;
  note: string | null;
  time: string;
  endTime: string | null;
}

export type Validation<Value> = { ok: true; value: Value } | { ok: false; error: string };

export interface CourtColumn<Item> {
  number: number;
  /** Null for a court number that items use but no court row describes. */
  court: Court | null;
  items: Item[];
}

export type MoveDirection = "up" | "down";

/** A 24-hour "HH:MM" time. */
export function isScheduleTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

function utcMidnight(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

/**
 * Each day from the start date to the end date, as YYYY-MM-DD. Empty without
 * a valid start date; one day when the end date is missing or before the start.
 */
export function tournamentDays(startsOn: string | null, endsOn: string | null): string[] {
  if (startsOn === null || !isCalendarDate(startsOn)) return [];
  const lastDay = endsOn !== null && isCalendarDate(endsOn) ? endsOn : startsOn;
  const span = Math.round((utcMidnight(lastDay) - utcMidnight(startsOn)) / MS_PER_DAY) + 1;
  const count = Math.min(Math.max(span, 1), MAX_SCHEDULE_DAYS);
  return Array.from({ length: count }, (_, index) =>
    new Date(utcMidnight(startsOn) + index * MS_PER_DAY).toISOString().slice(0, 10),
  );
}

/** The tournament's days plus any other day that still has items, in date order. */
export function scheduleDayChoices(days: readonly string[], usedDays: readonly string[]): string[] {
  return [...new Set([...days, ...usedDays])].sort();
}

/** e.g. "Sat 26 Sept". */
export function formatScheduleDay(day: string): string {
  if (!isCalendarDate(day)) throw new Error(`"${day}" is not a YYYY-MM-DD date.`);
  return DAY_LABEL.format(new Date(utcMidnight(day))).replace(",", "");
}

export function scheduleEntryOf(item: ScheduleItem): ScheduleEntry {
  return {
    id: item.id,
    day: item.day,
    courtNumber: item.courtNumber,
    position: item.position,
    kind: item.kind,
    matchId: item.matchId,
    title: item.title,
    note: item.note,
    timing: item.timing,
    time: item.time,
    endTime: item.endTime,
    umpireEmail: item.umpireEmail,
  };
}

/** Court by court, top of the list first. */
export function sortEntries<Item extends Pick<ScheduleEntry, "courtNumber" | "position">>(
  items: readonly Item[],
): Item[] {
  return [...items].sort((a, b) => a.courtNumber - b.courtNumber || a.position - b.position);
}

function entryKey(entry: ScheduleEntry): string {
  return JSON.stringify([
    entry.id,
    entry.day,
    entry.courtNumber,
    entry.position,
    entry.kind,
    entry.matchId,
    entry.title,
    entry.note,
    entry.timing,
    entry.time,
    entry.endTime,
    entry.umpireEmail,
  ]);
}

/**
 * True when the working order of play differs from what umpires see. A day
 * never published has changes once it has any item.
 */
export function hasUnpublishedChanges(
  draft: readonly ScheduleEntry[],
  published: readonly ScheduleEntry[] | null,
): boolean {
  if (published === null) return draft.length > 0;
  const keys = (entries: readonly ScheduleEntry[]) => sortEntries(entries).map(entryKey).join("\n");
  return keys(draft) !== keys(published);
}

/**
 * When an item plays, e.g. "11:00", "Not before 15:30", "After M21" or
 * "12:00–14:00". `previous` names the item above it on the court.
 */
export function timingLabel(
  entry: Pick<ScheduleEntry, "kind" | "timing" | "time" | "endTime">,
  previous: string | null,
): string {
  if (entry.timing === "followOn") return previous === null ? "Time to follow" : `After ${previous}`;
  if (entry.time === null) throw new Error(`A "${entry.timing}" schedule item needs a time.`);
  if (entry.kind === "block" && entry.endTime !== null) return `${entry.time}–${entry.endTime}`;
  return entry.timing === "notBefore" ? `Not before ${entry.time}` : entry.time;
}

/** The earliest time on a day's order of play, or null when nothing has a time. */
export function playFrom(entries: readonly Pick<ScheduleEntry, "time">[]): string | null {
  const times = entries.flatMap((entry) => (entry.time === null ? [] : [entry.time])).sort();
  return times[0] ?? null;
}

/** One column per court: every described court, plus any number only items use. */
export function courtColumns<Item extends Pick<ScheduleEntry, "courtNumber" | "position">>(
  courts: readonly Court[],
  items: readonly Item[],
): CourtColumn<Item>[] {
  const numbers = [
    ...new Set([...courts.map((court) => court.number), ...items.map((item) => item.courtNumber)]),
  ].sort((a, b) => a - b);
  return numbers.map((number) => ({
    number,
    court: courts.find((court) => court.number === number) ?? null,
    items: sortEntries(items.filter((item) => item.courtNumber === number)),
  }));
}

export function courtTitle(number: number): string {
  return `Court ${number}`;
}

/** e.g. "Centre · Hard", or null when the court has neither. */
export function courtDetail(court: Pick<Court, "name" | "surface"> | null): string | null {
  if (court === null) return null;
  const parts = [court.name, court.surface].filter((part): part is string => part !== null);
  return parts.length === 0 ? null : parts.join(" · ");
}

/** The number a new court takes: one more than the highest. */
export function nextCourtNumber(existing: readonly Pick<Court, "number">[]): number {
  const next = Math.max(0, ...existing.map((court) => court.number)) + 1;
  if (next > MAX_COURT) throw new Error(`A tournament can have at most ${MAX_COURT} courts.`);
  return next;
}

/** Ids in their new order after moving `id` one place; unchanged at either end. */
export function moveInOrder(ids: readonly string[], id: string, direction: MoveDirection): string[] {
  const from = ids.indexOf(id);
  if (from === -1) throw new Error(`Schedule item ${id} is not in this list.`);
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= ids.length) return [...ids];
  const moved = [...ids];
  [moved[from], moved[to]] = [moved[to], moved[from]];
  return moved;
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function validateCourt(input: { name: string; surface: string }): Validation<CourtFields> {
  const name = optionalText(input.name);
  const surface = optionalText(input.surface);
  if (name !== null && name.length > MAX_COURT_NAME_LENGTH) {
    return { ok: false, error: `Court names can be up to ${MAX_COURT_NAME_LENGTH} characters.` };
  }
  if (surface !== null && surface.length > MAX_COURT_SURFACE_LENGTH) {
    return { ok: false, error: `Surfaces can be up to ${MAX_COURT_SURFACE_LENGTH} characters.` };
  }
  return { ok: true, value: { name, surface } };
}

/** A timing from the form. "At" and "not before" need a time; following on drops it. */
export function validateTiming(input: {
  timing: string;
  time: string;
}): Validation<{ timing: ScheduleTiming; time: string | null }> {
  const timing = SCHEDULE_TIMINGS.find((value) => value === input.timing);
  if (timing === undefined) return { ok: false, error: "Choose when the match plays." };
  if (timing === "followOn") return { ok: true, value: { timing, time: null } };
  const time = input.time.trim();
  if (!isScheduleTime(time)) return { ok: false, error: "Enter a time such as 11:00." };
  return { ok: true, value: { timing, time } };
}

export function validateBlock(input: {
  title: string;
  note: string;
  time: string;
  endTime: string;
}): Validation<BlockFields> {
  const title = input.title.trim();
  const note = optionalText(input.note);
  const time = input.time.trim();
  const endTime = optionalText(input.endTime);
  if (title === "") return { ok: false, error: "Give the session a title." };
  if (title.length > MAX_BLOCK_TITLE_LENGTH) {
    return { ok: false, error: `Titles can be up to ${MAX_BLOCK_TITLE_LENGTH} characters.` };
  }
  if (note !== null && note.length > MAX_BLOCK_NOTE_LENGTH) {
    return { ok: false, error: `Notes can be up to ${MAX_BLOCK_NOTE_LENGTH} characters.` };
  }
  if (!isScheduleTime(time)) return { ok: false, error: "Enter a start time such as 12:00." };
  if (endTime !== null && !isScheduleTime(endTime)) {
    return { ok: false, error: "Enter an end time such as 14:00, or leave it empty." };
  }
  if (endTime !== null && endTime <= time) {
    return { ok: false, error: "The session must end after it starts." };
  }
  return { ok: true, value: { title, note, time, endTime } };
}
