import { and, asc, count, desc, eq, gte, isNull } from "drizzle-orm";

import type { Database } from "./draws";
import {
  REACTION_KINDS,
  draws,
  fanMessages,
  fanMutes,
  fanPredictions,
  fanReactions,
  matches,
  profiles,
  users,
  type Match,
  type ReactionKind,
} from "./schema";
import { FAN_MESSAGE_LIMIT, checkFanMessage, fanName } from "@/lib/fan-chat";
import {
  countVotes,
  currentSetNumber,
  leaderboard,
  predictionsOpen,
  setWinners,
  type FanScore,
  type PredictionOutcome,
} from "@/lib/fan-predictions";
import { deriveState, type MatchState, type Side } from "@/lib/match";
import { formatOfRecord, scoreRecordOf } from "@/lib/score-record";

/** A fan broke a chat or prediction rule. Its message is for the fan. */
export class FanRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FanRejectedError";
  }
}

export const EXPIRED_SIGN_IN = "Your sign-in has expired. Sign in again.";

/**
 * A fan's sign-in lasts in their browser, so it can outlive their account, e.g. after the
 * database is restored. Writing for a missing account would break a foreign key.
 */
function requireFanAccount(database: Database, userId: string): void {
  const account = database.select({ id: users.id }).from(users).where(eq(users.id, userId)).get();
  if (account === undefined) throw new FanRejectedError(EXPIRED_SIGN_IN);
}

/** A chat message as the public page shows it: a display name, never an email. */
export interface ChatMessage {
  id: string;
  name: string;
  body: string;
  createdAt: number;
}

/** A chat message as an admin sees it, with the account behind it. */
export interface ModeratedMessage extends ChatMessage {
  userId: string;
  email: string;
  courtNumber: number;
  hiddenAt: number | null;
  muted: boolean;
}

function messageQuery(database: Database) {
  return database
    .select({
      id: fanMessages.id,
      body: fanMessages.body,
      createdAt: fanMessages.createdAt,
      courtNumber: fanMessages.courtNumber,
      hiddenAt: fanMessages.hiddenAt,
      userId: fanMessages.userId,
      email: users.email,
      accountName: users.name,
      fullName: profiles.fullName,
      mutedAt: fanMutes.mutedAt,
    })
    .from(fanMessages)
    .innerJoin(users, eq(fanMessages.userId, users.id))
    .leftJoin(profiles, eq(profiles.userId, fanMessages.userId))
    .leftJoin(fanMutes, eq(fanMutes.userId, fanMessages.userId));
}

/**
 * One court's chat since `since`, oldest first, or all of it when `since` is null. The
 * court page passes the current match's start, so each match has its own chat. Hidden
 * messages are left out.
 */
export function listCourtMessages(
  database: Database,
  tournamentId: string,
  courtNumber: number,
  since: number | null,
): ChatMessage[] {
  return messageQuery(database)
    .where(
      and(
        eq(fanMessages.tournamentId, tournamentId),
        eq(fanMessages.courtNumber, courtNumber),
        isNull(fanMessages.hiddenAt),
        since === null ? undefined : gte(fanMessages.createdAt, since),
      ),
    )
    .orderBy(desc(fanMessages.createdAt))
    .limit(FAN_MESSAGE_LIMIT)
    .all()
    .map((row) => ({
      id: row.id,
      name: fanName(row.fullName, row.accountName),
      body: row.body,
      createdAt: row.createdAt,
    }))
    .reverse();
}

/** The latest messages across every court, for the moderation page. */
export function listMessagesToModerate(
  database: Database,
  tournamentId: string,
  limit: number,
): ModeratedMessage[] {
  return messageQuery(database)
    .where(eq(fanMessages.tournamentId, tournamentId))
    .orderBy(desc(fanMessages.createdAt))
    .limit(limit)
    .all()
    .map((row) => ({
      id: row.id,
      name: fanName(row.fullName, row.accountName),
      body: row.body,
      createdAt: row.createdAt,
      courtNumber: row.courtNumber,
      hiddenAt: row.hiddenAt,
      userId: row.userId,
      email: row.email,
      muted: row.mutedAt !== null,
    }));
}

export function isMuted(database: Database, userId: string): boolean {
  return database.select({ userId: fanMutes.userId }).from(fanMutes).where(eq(fanMutes.userId, userId)).get() !== undefined;
}

function lastMessageAt(database: Database, userId: string): number | null {
  const row = database
    .select({ createdAt: fanMessages.createdAt })
    .from(fanMessages)
    .where(eq(fanMessages.userId, userId))
    .orderBy(desc(fanMessages.createdAt))
    .limit(1)
    .get();
  return row?.createdAt ?? null;
}

/** Posts a fan's message to a court chat, or explains why it cannot be posted. */
export function postFanMessage(
  database: Database,
  input: { tournamentId: string; courtNumber: number; userId: string; body: string; now: number },
): void {
  database.transaction((tx) => {
    requireFanAccount(tx, input.userId);
    const check = checkFanMessage({
      body: input.body,
      muted: isMuted(tx, input.userId),
      lastMessageAt: lastMessageAt(tx, input.userId),
      now: input.now,
    });
    if (!check.ok) throw new FanRejectedError(check.error);

    tx.insert(fanMessages)
      .values({
        tournamentId: input.tournamentId,
        courtNumber: input.courtNumber,
        userId: input.userId,
        body: input.body.trim(),
        createdAt: input.now,
      })
      .run();
  });
}

/** Takes a message off the public chat. It stays in the table for the record. */
export function hideMessage(database: Database, messageId: string, adminEmail: string): void {
  const result = database
    .update(fanMessages)
    .set({ hiddenAt: Date.now(), hiddenBy: adminEmail.trim().toLowerCase() })
    .where(eq(fanMessages.id, messageId))
    .run();
  if (result.changes === 0) throw new Error(`Message ${messageId} does not exist.`);
}

/** Puts a hidden message back on the chat. */
export function showMessage(database: Database, messageId: string): void {
  const result = database
    .update(fanMessages)
    .set({ hiddenAt: null, hiddenBy: null })
    .where(eq(fanMessages.id, messageId))
    .run();
  if (result.changes === 0) throw new Error(`Message ${messageId} does not exist.`);
}

/** Stops a fan from posting. Their messages stay until an admin hides them. */
export function muteFan(database: Database, userId: string, adminEmail: string): void {
  database
    .insert(fanMutes)
    .values({ userId, mutedBy: adminEmail.trim().toLowerCase(), mutedAt: Date.now() })
    .onConflictDoNothing()
    .run();
}

export function unmuteFan(database: Database, userId: string): void {
  database.delete(fanMutes).where(eq(fanMutes.userId, userId)).run();
}

/** The shortest gap between two of one fan's reactions on a match that both count. */
export const REACTION_COOLDOWN_MS = 2_000;

/**
 * Records a fan's reaction to a match. A fan may react as often as they like, but a tap
 * within the cooldown of their last one is dropped, so one fan cannot run up the count.
 * Returns whether the tap counted.
 */
export function addReaction(
  database: Database,
  input: { matchId: string; userId: string; kind: ReactionKind; now: number },
): boolean {
  return database.transaction((tx) => {
    requireFanAccount(tx, input.userId);
    const last = tx
      .select({ createdAt: fanReactions.createdAt })
      .from(fanReactions)
      .where(and(eq(fanReactions.matchId, input.matchId), eq(fanReactions.userId, input.userId)))
      .orderBy(desc(fanReactions.createdAt))
      .limit(1)
      .get();
    if (last !== undefined && input.now - last.createdAt < REACTION_COOLDOWN_MS) return false;
    tx.insert(fanReactions)
      .values({ matchId: input.matchId, userId: input.userId, kind: input.kind, createdAt: input.now })
      .run();
    return true;
  });
}

/** How many taps each reaction has had on a match. */
export function countReactions(database: Database, matchId: string): Record<ReactionKind, number> {
  const counts = Object.fromEntries(REACTION_KINDS.map((kind) => [kind, 0])) as Record<ReactionKind, number>;
  for (const row of database
    .select({ kind: fanReactions.kind, taps: count() })
    .from(fanReactions)
    .where(eq(fanReactions.matchId, matchId))
    .groupBy(fanReactions.kind)
    .all()) {
    counts[row.kind] = row.taps;
  }
  return counts;
}

function matchState(match: Match): MatchState | null {
  const record = scoreRecordOf(match);
  if (record === null) return null;
  return deriveState(record.events, formatOfRecord(record), record.firstServer);
}

/**
 * Records a fan's pick for a set. A fan may change their mind until the set
 * closes at five games.
 */
export function savePrediction(
  database: Database,
  input: { matchId: string; setNumber: number; userId: string; side: Side },
): void {
  database.transaction((tx) => {
    requireFanAccount(tx, input.userId);
    const match = tx.select().from(matches).where(eq(matches.id, input.matchId)).get();
    if (!match) throw new FanRejectedError("This match is not being played.");
    const state = matchState(match);
    if (match.status !== "in_progress" || state === null || !predictionsOpen(state)) {
      throw new FanRejectedError("Predictions for this set have closed.");
    }
    if (input.setNumber !== currentSetNumber(state)) {
      throw new FanRejectedError("That set is not being played.");
    }

    tx.insert(fanPredictions)
      .values({ matchId: input.matchId, setNumber: input.setNumber, userId: input.userId, side: input.side })
      .onConflictDoUpdate({
        target: [fanPredictions.matchId, fanPredictions.setNumber, fanPredictions.userId],
        set: { side: input.side, createdAt: Date.now() },
      })
      .run();
  });
}

/** How the latest finished set a fan called went. */
export interface SetCall {
  matchId: string;
  setNumber: number;
  own: Side;
  winner: Side;
}

/**
 * The fan's pick on the latest finished set of a match they called, or null when they
 * called none that has finished. A match's last set counts once the match is over.
 */
export function latestSetCall(database: Database, match: Match, userId: string): SetCall | null {
  const state = matchState(match);
  if (state === null) return null;
  const winners = setWinners(state);
  const picks = database
    .select({ setNumber: fanPredictions.setNumber, side: fanPredictions.side })
    .from(fanPredictions)
    .where(and(eq(fanPredictions.matchId, match.id), eq(fanPredictions.userId, userId)))
    .orderBy(desc(fanPredictions.setNumber))
    .all();
  for (const pick of picks) {
    const winner = winners.get(pick.setNumber);
    if (winner !== undefined) return { matchId: match.id, setNumber: pick.setNumber, own: pick.side, winner };
  }
  return null;
}

/** The votes for one set of a match. */
export function countPredictions(
  database: Database,
  matchId: string,
  setNumber: number,
): Record<Side, number> {
  const rows = database
    .select({ side: fanPredictions.side })
    .from(fanPredictions)
    .where(and(eq(fanPredictions.matchId, matchId), eq(fanPredictions.setNumber, setNumber)))
    .all();
  return countVotes(rows.map((row) => row.side));
}

/** This fan's pick for one set, or null when they have not picked. */
export function getOwnPrediction(
  database: Database,
  matchId: string,
  setNumber: number,
  userId: string,
): Side | null {
  const row = database
    .select({ side: fanPredictions.side })
    .from(fanPredictions)
    .where(
      and(
        eq(fanPredictions.matchId, matchId),
        eq(fanPredictions.setNumber, setNumber),
        eq(fanPredictions.userId, userId),
      ),
    )
    .get();
  return row?.side ?? null;
}

/**
 * The fan prediction leaderboard. Points come from replaying each match, so
 * a corrected score corrects the table with it.
 */
export function fanLeaderboard(database: Database, tournamentId: string): FanScore[] {
  const rows = database
    .select({
      userId: fanPredictions.userId,
      setNumber: fanPredictions.setNumber,
      side: fanPredictions.side,
      match: matches,
      accountName: users.name,
      fullName: profiles.fullName,
    })
    .from(fanPredictions)
    .innerJoin(matches, eq(fanPredictions.matchId, matches.id))
    .innerJoin(draws, eq(matches.drawId, draws.id))
    .innerJoin(users, eq(fanPredictions.userId, users.id))
    .leftJoin(profiles, eq(profiles.userId, fanPredictions.userId))
    .where(eq(draws.tournamentId, tournamentId))
    .orderBy(asc(fanPredictions.createdAt))
    .all();

  const winnersByMatch = new Map<string, Map<number, Side>>();
  const outcomes: PredictionOutcome[] = rows.map((row) => {
    let winners = winnersByMatch.get(row.match.id);
    if (winners === undefined) {
      const state = matchState(row.match);
      winners = state === null ? new Map<number, Side>() : setWinners(state);
      winnersByMatch.set(row.match.id, winners);
    }
    return {
      userId: row.userId,
      name: fanName(row.fullName, row.accountName),
      side: row.side,
      winner: winners.get(row.setNumber) ?? null,
    };
  });

  return leaderboard(outcomes);
}

/** Drops a match's predictions and reactions, for a score that is being replayed. */
export function clearMatchFanData(database: Database, matchId: string): void {
  database.delete(fanPredictions).where(eq(fanPredictions.matchId, matchId)).run();
  database.delete(fanReactions).where(eq(fanReactions.matchId, matchId)).run();
}
