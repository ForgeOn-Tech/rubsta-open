import { CATEGORIES, CATEGORY_LABELS, type Category, type Tournament } from "@/db/schema";
import type { MatchFormat } from "@/lib/match";
import { isScheduleTime } from "@/lib/schedule";

/** Minutes a match is expected to take, by how long its format is. The organiser can change them. */
export interface MatchLengths {
  oneSet: number;
  eightGames: number;
  bestOfThree: number;
}

export const DEFAULT_MATCH_LENGTHS: MatchLengths = { oneSet: 45, eightGames: 60, bestOfThree: 90 };
export const DEFAULT_REST_MINUTES = 30;
export const DEFAULT_START_TIME = "08:00";
const MINUTES_PER_HOUR = 60;
const LAST_MINUTE_OF_DAY = 24 * MINUTES_PER_HOUR - 1;
/** Rest-driven start times round up to the next 5 minutes. */
const TIME_STEP_MINUTES = 5;

/** The rest and match lengths a tournament schedules with. */
export interface ScheduleSettings {
  restMinutes: number;
  lengths: MatchLengths;
}

/** What the last fill saved, each value falling back to its default. */
export function scheduleSettingsOf(
  tournament: Pick<Tournament, "scheduleRestMinutes" | "oneSetMinutes" | "eightGamesMinutes" | "bestOfThreeMinutes">,
): ScheduleSettings {
  return {
    restMinutes: tournament.scheduleRestMinutes ?? DEFAULT_REST_MINUTES,
    lengths: {
      oneSet: tournament.oneSetMinutes ?? DEFAULT_MATCH_LENGTHS.oneSet,
      eightGames: tournament.eightGamesMinutes ?? DEFAULT_MATCH_LENGTHS.eightGames,
      bestOfThree: tournament.bestOfThreeMinutes ?? DEFAULT_MATCH_LENGTHS.bestOfThree,
    },
  };
}

export function expectedMinutes(format: MatchFormat, lengths: MatchLengths): number {
  if (format.setsToWin > 1) return lengths.bestOfThree;
  return format.gamesPerSet > 6 ? lengths.eightGames : lengths.oneSet;
}

/** "08:30" → 510. */
export function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * MINUTES_PER_HOUR + minutes;
}

/** 510 → "08:30". */
export function clockOf(minutes: number): string {
  const whole = Math.min(LAST_MINUTE_OF_DAY, Math.max(0, Math.round(minutes)));
  const hours = Math.floor(whole / MINUTES_PER_HOUR);
  return `${String(hours).padStart(2, "0")}:${String(whole % MINUTES_PER_HOUR).padStart(2, "0")}`;
}

function roundUp(minutes: number): number {
  return Math.ceil(minutes / TIME_STEP_MINUTES) * TIME_STEP_MINUTES;
}

/** A match to place. */
export interface PlanMatch {
  id: string;
  /** Everyone who may play it: its players, or for a slot still to be decided, everyone who could reach it. */
  players: readonly string[];
  /** Earliest start, in minutes after midnight: when every match it waits on should be over, plus rest. */
  readyAt: number;
  /** Matches in this plan whose results it waits on. */
  after: readonly string[];
  minutes: number;
}

/** A court's state before the plan: from when it is free. */
export interface CourtFree {
  courtNumber: number;
  freeFrom: number;
}

export interface PlannedMatch {
  matchId: string;
  courtNumber: number;
  start: number;
  end: number;
}

/** Why a match was left off: it waits on a match left off, or it would start after the last start. */
export type UnplacedReason = "waits" | "late";

export interface DayPlan {
  placed: PlannedMatch[];
  unplaced: { matchId: string; reason: UnplacedReason }[];
}

/**
 * Places matches one at a time: of the matches whose earlier matches are placed, the one that
 * can start soonest goes next, on the court where it can start soonest; a tie keeps the order
 * given. So an event that starts later does not take a court the morning could still use.
 * A match starts only when its court is free, every match it waits on is over, and none of its
 * possible players has played within `restMinutes`. `busyUntil` holds each player's last
 * finish already on the day, so a fill after earlier matches still gives rest.
 */
export function planDay(input: {
  courts: readonly CourtFree[];
  matches: readonly PlanMatch[];
  restMinutes: number;
  busyUntil: ReadonlyMap<string, number>;
  /** No match starts after this, in minutes after midnight; null for no limit. */
  latestStart: number | null;
}): DayPlan {
  if (input.courts.length === 0) throw new Error("Choose at least one court to fill.");
  const courtFree = new Map(input.courts.map((court) => [court.courtNumber, court.freeFrom]));
  const playerFree = new Map([...input.busyUntil].map(([player, end]) => [player, end + input.restMinutes]));
  const endOf = new Map<string, number>();
  const placed: PlannedMatch[] = [];
  const unplaced: DayPlan["unplaced"] = [];

  const soonest = (match: PlanMatch): { courtNumber: number; start: number } => {
    const ready = Math.max(
      match.readyAt,
      ...match.after.map((id) => (endOf.get(id) as number) + input.restMinutes),
      ...match.players.map((player) => playerFree.get(player) ?? 0),
    );
    const [courtNumber, start] = [...courtFree.entries()]
      .map(([court, free]): [number, number] => [court, roundUp(Math.max(free, ready))])
      .sort((a, b) => a[1] - b[1] || a[0] - b[0])[0];
    return { courtNumber, start };
  };

  let remaining = [...input.matches];
  for (;;) {
    const next = remaining
      .filter((match) => match.after.every((id) => endOf.has(id)))
      .map((match) => ({ match, ...soonest(match) }))
      // Stable: on equal starts the earlier match in the given order stays first.
      .sort((a, b) => a.start - b.start)[0];
    if (next === undefined) break;
    remaining = remaining.filter((match) => match !== next.match);
    if (input.latestStart !== null && next.start > input.latestStart) {
      unplaced.push({ matchId: next.match.id, reason: "late" });
      continue;
    }
    const end = next.start + next.match.minutes;
    courtFree.set(next.courtNumber, end);
    for (const player of next.match.players) playerFree.set(player, end + input.restMinutes);
    endOf.set(next.match.id, end);
    placed.push({ matchId: next.match.id, courtNumber: next.courtNumber, start: next.start, end });
  }
  // What is left waits on a match that was never placed.
  for (const match of remaining) unplaced.push({ matchId: match.id, reason: "waits" });
  return { placed, unplaced };
}

export type PlannedTiming = { timing: "at" | "notBefore"; time: string } | { timing: "followOn"; time: null };

/**
 * How a planned match reads on the order of play: the first on an empty court starts at its
 * time; one that starts as the match above it ends follows on; any other waits for its time.
 */
export function timingFor(start: number, previousEnd: number | null): PlannedTiming {
  if (previousEnd === null) return { timing: "at", time: clockOf(start) };
  if (start <= previousEnd) return { timing: "followOn", time: null };
  return { timing: "notBefore", time: clockOf(start) };
}

/** One item already on a court, as far as timing goes. */
export interface CourtItemTiming {
  timing: "at" | "notBefore" | "followOn";
  time: string | null;
  endTime: string | null;
  /** Expected minutes for a match; null for a session, which runs to its end time. */
  minutes: number | null;
}

/**
 * When a court's existing items should be over, walking down from its first item. A timed
 * item starts at its own time, even before `dayStart`; only a first item with no time
 * starts at `dayStart`. The end never moves back, so a short session at a fixed time
 * does not free a court a longer match still holds. Null with no items.
 */
export function courtEnd(items: readonly CourtItemTiming[], dayStart: number): number | null {
  let end: number | null = null;
  for (const item of items) {
    const own = item.timing === "followOn" || item.time === null ? null : minutesOf(item.time);
    const start =
      own === null ? (end ?? dayStart) : item.timing === "notBefore" && end !== null ? Math.max(own, end) : own;
    const finish = item.minutes !== null ? start + item.minutes : item.endTime !== null ? minutesOf(item.endTime) : start;
    end = Math.max(end ?? start, start, finish);
  }
  return end;
}

/** What the organiser asks the fill for. */
export interface FillRequest {
  day: string;
  courts: readonly number[];
  startTime: string;
  /** No match starts after this time ("18:00"); null for no limit. */
  finishBy: string | null;
  restMinutes: number;
  lengths: MatchLengths;
  /** Rounds to place, as `${category}|${roundName}`. */
  rounds: readonly string[];
  /** An event's own first start ("14:00"); an event left out starts with the fill. */
  eventStarts: Partial<Record<Category, string>>;
}

const MAX_REST_MINUTES = 240;
const MIN_MATCH_MINUTES = 10;
const MAX_MATCH_MINUTES = 300;

export interface RawFillRequest {
  day: string;
  courts: readonly string[];
  startTime: string;
  /** Blank for no limit. */
  finishBy: string;
  restMinutes: string;
  oneSet: string;
  eightGames: string;
  bestOfThree: string;
  rounds: readonly string[];
  /** Blank for an event that starts with the fill. */
  eventStarts: Partial<Record<Category, string>>;
}

export type FillValidation = { ok: true; request: FillRequest } | { ok: false; error: string };

function wholeIn(raw: string, min: number, max: number): number | null {
  const value = Number(raw.trim());
  return raw.trim() !== "" && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

/** Checks the fill form. `days` and `courtNumbers` are what the tournament has. */
export function validateFillRequest(
  raw: RawFillRequest,
  days: readonly string[],
  courtNumbers: readonly number[],
): FillValidation {
  if (!days.includes(raw.day)) return { ok: false, error: "Choose one of the tournament's days." };
  const courts = raw.courts.map(Number).filter((court) => courtNumbers.includes(court));
  if (courts.length === 0 || courts.length !== raw.courts.length) return { ok: false, error: "Choose at least one of the courts." };
  if (!isScheduleTime(raw.startTime)) return { ok: false, error: "Enter a start time such as 08:00." };
  const finishBy = raw.finishBy.trim() === "" ? null : raw.finishBy.trim();
  if (finishBy !== null && (!isScheduleTime(finishBy) || minutesOf(finishBy) <= minutesOf(raw.startTime))) {
    return { ok: false, error: "The last start must be a time after the first match, or blank." };
  }
  const restMinutes = wholeIn(raw.restMinutes, 0, MAX_REST_MINUTES);
  if (restMinutes === null) return { ok: false, error: `Rest must be a whole number of minutes from 0 to ${MAX_REST_MINUTES}.` };
  const lengths = {
    oneSet: wholeIn(raw.oneSet, MIN_MATCH_MINUTES, MAX_MATCH_MINUTES),
    eightGames: wholeIn(raw.eightGames, MIN_MATCH_MINUTES, MAX_MATCH_MINUTES),
    bestOfThree: wholeIn(raw.bestOfThree, MIN_MATCH_MINUTES, MAX_MATCH_MINUTES),
  };
  if (lengths.oneSet === null || lengths.eightGames === null || lengths.bestOfThree === null) {
    return { ok: false, error: `Match lengths must be whole minutes from ${MIN_MATCH_MINUTES} to ${MAX_MATCH_MINUTES}.` };
  }
  if (raw.rounds.length === 0) return { ok: false, error: "Choose at least one round to place." };
  const eventStarts: Partial<Record<Category, string>> = {};
  for (const category of CATEGORIES) {
    const time = (raw.eventStarts[category] ?? "").trim();
    if (time === "") continue;
    if (!isScheduleTime(time) || minutesOf(time) < minutesOf(raw.startTime)) {
      return { ok: false, error: `Enter the ${CATEGORY_LABELS[category]} start as a time at or after the first match, or leave it blank.` };
    }
    eventStarts[category] = time;
  }
  return {
    ok: true,
    request: {
      day: raw.day,
      courts: [...new Set(courts)].sort((a, b) => a - b),
      startTime: raw.startTime,
      finishBy,
      restMinutes,
      lengths: { oneSet: lengths.oneSet, eightGames: lengths.eightGames, bestOfThree: lengths.bestOfThree },
      rounds: raw.rounds,
      eventStarts,
    },
  };
}
