import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";

import type { Database } from "./draws";
import {
  CATEGORY_LABELS,
  courts,
  draws,
  matches,
  profiles,
  scheduleDays,
  scheduleItems,
  users,
  type ScheduleDay,
  type ScheduleItem,
  type ScheduleTiming,
} from "./schema";
import {
  formatScheduleDay,
  moveInOrder,
  scheduleEntryOf,
  sortEntries,
  type BlockFields,
  type MoveDirection,
} from "@/lib/schedule";
import { isCalendarDate } from "@/lib/settings";

/** No schedule item has the given id. */
export class ScheduleItemNotFoundError extends Error {
  constructor(itemId: string) {
    super(`Schedule item ${itemId} does not exist.`);
    this.name = "ScheduleItemNotFoundError";
  }
}

/** A change breaks a rule of the order of play. Its message is for the admin. */
export class ScheduleRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScheduleRejectedError";
  }
}

export interface MatchPlacement {
  day: string;
  courtNumber: number;
  matchId: string;
  timing: ScheduleTiming;
  time: string | null;
  umpireEmail: string | null;
}

export interface MatchItemChanges {
  timing: ScheduleTiming;
  time: string | null;
  umpireEmail: string | null;
}

export interface BlockPlacement {
  day: string;
  courtNumber: number;
  block: BlockFields;
}

function requireDay(day: string): void {
  if (!isCalendarDate(day)) throw new Error(`"${day}" is not a YYYY-MM-DD date.`);
}

/** One schedule item. Throws ScheduleItemNotFoundError for an unknown id. */
export function getScheduleItem(database: Database, itemId: string): ScheduleItem {
  const item = database.select().from(scheduleItems).where(eq(scheduleItems.id, itemId)).get();
  if (!item) throw new ScheduleItemNotFoundError(itemId);
  return item;
}

function courtItems(
  database: Database,
  tournamentId: string,
  day: string,
  courtNumber: number,
): ScheduleItem[] {
  return database
    .select()
    .from(scheduleItems)
    .where(
      and(
        eq(scheduleItems.tournamentId, tournamentId),
        eq(scheduleItems.day, day),
        eq(scheduleItems.courtNumber, courtNumber),
      ),
    )
    .orderBy(asc(scheduleItems.position))
    .all();
}

function nextPosition(database: Database, tournamentId: string, day: string, courtNumber: number): number {
  const positions = courtItems(database, tournamentId, day, courtNumber).map((item) => item.position);
  return Math.max(0, ...positions) + 1;
}

/** Sets positions 1, 2, 3… in the given order. */
function renumber(database: Database, ids: readonly string[]): void {
  const now = Date.now();
  ids.forEach((id, index) => {
    database
      .update(scheduleItems)
      .set({ position: index + 1, updatedAt: now })
      .where(eq(scheduleItems.id, id))
      .run();
  });
}

function requireCourt(database: Database, tournamentId: string, courtNumber: number): void {
  const court = database
    .select({ id: courts.id })
    .from(courts)
    .where(and(eq(courts.tournamentId, tournamentId), eq(courts.number, courtNumber)))
    .get();
  if (!court) {
    throw new ScheduleRejectedError(`Court ${courtNumber} does not exist. Add it in Settings first.`);
  }
}

/** A day's working order of play, court by court. */
export function listScheduleItems(database: Database, tournamentId: string, day: string): ScheduleItem[] {
  const items = database
    .select()
    .from(scheduleItems)
    .where(and(eq(scheduleItems.tournamentId, tournamentId), eq(scheduleItems.day, day)))
    .all();
  return sortEntries(items);
}

/** Every day with working items or a published order of play. */
export function listScheduleDaysInUse(database: Database, tournamentId: string): string[] {
  const working = database
    .selectDistinct({ day: scheduleItems.day })
    .from(scheduleItems)
    .where(eq(scheduleItems.tournamentId, tournamentId))
    .all();
  const published = database
    .select({ day: scheduleDays.day })
    .from(scheduleDays)
    .where(eq(scheduleDays.tournamentId, tournamentId))
    .all();
  return [...new Set([...working, ...published].map((row) => row.day))].sort();
}

/** Ids of the matches that have a place on the working order of play, on any day. */
export function listScheduledMatchIds(database: Database, tournamentId: string): Set<string> {
  const rows = database
    .select({ matchId: scheduleItems.matchId })
    .from(scheduleItems)
    .where(and(eq(scheduleItems.tournamentId, tournamentId), isNotNull(scheduleItems.matchId)))
    .all();
  return new Set(rows.flatMap((row) => (row.matchId === null ? [] : [row.matchId])));
}

/**
 * Names for the given lower-case emails: the profile name, else the account
 * name. Emails with no account or no name are left out.
 */
export function listNamesByEmail(database: Database, emails: readonly string[]): Map<string, string> {
  if (emails.length === 0) return new Map();
  const rows = database
    .select({ email: users.email, accountName: users.name, fullName: profiles.fullName })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(inArray(users.email, [...emails]))
    .all();
  return new Map(
    rows.flatMap((row): [string, string][] => {
      const name = row.fullName ?? row.accountName;
      return name === null ? [] : [[row.email.toLowerCase(), name]];
    }),
  );
}

/** Puts a match at the bottom of a court's list for the day. */
export function addMatchItem(
  database: Database,
  tournamentId: string,
  placement: MatchPlacement,
): ScheduleItem {
  requireDay(placement.day);
  return database.transaction((tx) => {
    const row = tx
      .select({ match: matches, draw: draws })
      .from(matches)
      .innerJoin(draws, eq(matches.drawId, draws.id))
      .where(eq(matches.id, placement.matchId))
      .get();
    if (!row || row.draw.tournamentId !== tournamentId) {
      throw new ScheduleRejectedError("That match is not in this tournament's published draws.");
    }
    const { match } = row;
    const name = `${CATEGORY_LABELS[row.draw.category]} M${match.matchNumber}`;
    if (match.topSlot.kind === "bye" || match.bottomSlot.kind === "bye") {
      throw new ScheduleRejectedError(`${name} is a bye, so it needs no court.`);
    }
    if (match.status === "completed") {
      throw new ScheduleRejectedError(`${name} is already complete.`);
    }
    const existing = tx
      .select({ day: scheduleItems.day })
      .from(scheduleItems)
      .where(eq(scheduleItems.matchId, match.id))
      .get();
    if (existing) {
      throw new ScheduleRejectedError(
        `${name} is already on the order of play for ${formatScheduleDay(existing.day)}.`,
      );
    }
    requireCourt(tx, tournamentId, placement.courtNumber);

    return tx
      .insert(scheduleItems)
      .values({
        tournamentId,
        day: placement.day,
        courtNumber: placement.courtNumber,
        position: nextPosition(tx, tournamentId, placement.day, placement.courtNumber),
        kind: "match",
        matchId: match.id,
        timing: placement.timing,
        time: placement.time,
        umpireEmail: placement.umpireEmail,
      })
      .returning()
      .get();
  });
}

/** Puts a session that is not a match, such as a challenge, at the bottom of a court's list. */
export function addBlockItem(
  database: Database,
  tournamentId: string,
  placement: BlockPlacement,
): ScheduleItem {
  requireDay(placement.day);
  return database.transaction((tx) => {
    requireCourt(tx, tournamentId, placement.courtNumber);
    return tx
      .insert(scheduleItems)
      .values({
        tournamentId,
        day: placement.day,
        courtNumber: placement.courtNumber,
        position: nextPosition(tx, tournamentId, placement.day, placement.courtNumber),
        kind: "block",
        title: placement.block.title,
        note: placement.block.note,
        timing: "at",
        time: placement.block.time,
        endTime: placement.block.endTime,
      })
      .returning()
      .get();
  });
}

export function updateMatchItem(database: Database, itemId: string, changes: MatchItemChanges): void {
  const item = getScheduleItem(database, itemId);
  if (item.kind !== "match") throw new Error(`Schedule item ${itemId} is not a match.`);
  database
    .update(scheduleItems)
    .set({ ...changes, updatedAt: Date.now() })
    .where(eq(scheduleItems.id, itemId))
    .run();
}

export function updateBlockItem(database: Database, itemId: string, block: BlockFields): void {
  const item = getScheduleItem(database, itemId);
  if (item.kind !== "block") throw new Error(`Schedule item ${itemId} is not a session.`);
  database
    .update(scheduleItems)
    .set({ ...block, timing: "at", updatedAt: Date.now() })
    .where(eq(scheduleItems.id, itemId))
    .run();
}

/** Swaps an item with its neighbour on the same court. */
export function moveItem(database: Database, itemId: string, direction: MoveDirection): void {
  database.transaction((tx) => {
    const item = getScheduleItem(tx, itemId);
    const ids = courtItems(tx, item.tournamentId, item.day, item.courtNumber).map((row) => row.id);
    renumber(tx, moveInOrder(ids, itemId, direction));
  });
}

/** Moves an item to the bottom of another court's list for the same day. */
export function moveItemToCourt(database: Database, itemId: string, courtNumber: number): void {
  database.transaction((tx) => {
    const item = getScheduleItem(tx, itemId);
    if (item.courtNumber === courtNumber) return;
    requireCourt(tx, item.tournamentId, courtNumber);

    tx.update(scheduleItems)
      .set({
        courtNumber,
        position: nextPosition(tx, item.tournamentId, item.day, courtNumber),
        updatedAt: Date.now(),
      })
      .where(eq(scheduleItems.id, itemId))
      .run();
    const left = courtItems(tx, item.tournamentId, item.day, item.courtNumber).map((row) => row.id);
    renumber(tx, left);
  });
}

/** Takes an item off the order of play and closes the gap it leaves. */
export function removeItem(database: Database, itemId: string): void {
  database.transaction((tx) => {
    const item = getScheduleItem(tx, itemId);
    tx.delete(scheduleItems).where(eq(scheduleItems.id, itemId)).run();
    const left = courtItems(tx, item.tournamentId, item.day, item.courtNumber).map((row) => row.id);
    renumber(tx, left);
  });
}

/** Copies a day's working order of play to what umpires see. */
export function publishDay(database: Database, tournamentId: string, day: string): ScheduleDay {
  requireDay(day);
  return database.transaction((tx) => {
    const items = listScheduleItems(tx, tournamentId, day).map(scheduleEntryOf);
    const publishedAt = Date.now();
    return tx
      .insert(scheduleDays)
      .values({ tournamentId, day, publishedAt, items })
      .onConflictDoUpdate({
        target: [scheduleDays.tournamentId, scheduleDays.day],
        set: { publishedAt, items },
      })
      .returning()
      .get();
  });
}

/** What umpires see for a day, or null when it was never published. */
export function getPublishedDay(database: Database, tournamentId: string, day: string): ScheduleDay | null {
  return (
    database
      .select()
      .from(scheduleDays)
      .where(and(eq(scheduleDays.tournamentId, tournamentId), eq(scheduleDays.day, day)))
      .get() ?? null
  );
}

/** Every published day, in date order. */
export function listPublishedDays(database: Database, tournamentId: string): ScheduleDay[] {
  return database
    .select()
    .from(scheduleDays)
    .where(eq(scheduleDays.tournamentId, tournamentId))
    .orderBy(asc(scheduleDays.day))
    .all();
}
