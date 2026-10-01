import { and, asc, desc, eq, isNull } from "drizzle-orm";

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
import { deriveState, standardFormat, type MatchState, type Side } from "@/lib/match";
import { scoreRecordOf } from "@/lib/score-record";

/** A fan broke a chat or prediction rule. Its message is for the fan. */
export class FanRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FanRejectedError";
  }
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

/** One court's chat, oldest first. Hidden messages are left out. */
export function listCourtMessages(
  database: Database,
  tournamentId: string,
  courtNumber: number,
): ChatMessage[] {
  return messageQuery(database)
    .where(
      and(
        eq(fanMessages.tournamentId, tournamentId),
        eq(fanMessages.courtNumber, courtNumber),
        isNull(fanMessages.hiddenAt),
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

/** Records a fan's reaction to a match. Sending the same one again changes nothing. */
export function addReaction(
  database: Database,
  matchId: string,
  userId: string,
  kind: ReactionKind,
): void {
  database.insert(fanReactions).values({ matchId, userId, kind }).onConflictDoNothing().run();
}

/** How many fans sent each reaction on a match. */
export function countReactions(database: Database, matchId: string): Record<ReactionKind, number> {
  const counts = Object.fromEntries(REACTION_KINDS.map((kind) => [kind, 0])) as Record<ReactionKind, number>;
  for (const row of database
    .select({ kind: fanReactions.kind })
    .from(fanReactions)
    .where(eq(fanReactions.matchId, matchId))
    .all()) {
    counts[row.kind] += 1;
  }
  return counts;
}

/** The reactions this fan has already sent on a match. */
export function listOwnReactions(database: Database, matchId: string, userId: string): ReactionKind[] {
  return database
    .select({ kind: fanReactions.kind })
    .from(fanReactions)
    .where(and(eq(fanReactions.matchId, matchId), eq(fanReactions.userId, userId)))
    .all()
    .map((row) => row.kind);
}

function matchState(match: Match): MatchState | null {
  const record = scoreRecordOf(match);
  if (record === null) return null;
  return deriveState(record.events, standardFormat(record.decidingSet), record.firstServer);
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
