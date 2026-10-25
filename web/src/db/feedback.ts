import { and, desc, eq, isNull } from "drizzle-orm";

import type { FeedbackInput, FeedbackRatings } from "@/lib/feedback";
import type { Database } from "./draws";
import { feedbackResponses, tournaments } from "./schema";

/**
 * Who is sending. A signed-in player is known by user id. A visitor is known only
 * by the response id their browser kept from an earlier send, or null the first time.
 */
export type FeedbackSender = { userId: string } | { visitorResponseId: string | null };

export interface FeedbackRow {
  id: string;
  fromPlayer: boolean;
  ratings: FeedbackRatings;
  comment: string | null;
  updatedAt: number;
}

export type SavedFeedback = typeof feedbackResponses.$inferSelect;

/** The sender's earlier response, to fill the form in again or to replace it. */
export function findOwnFeedback(database: Database, tournamentId: string, sender: FeedbackSender): SavedFeedback | undefined {
  if ("userId" in sender) {
    return database.select().from(feedbackResponses)
      .where(and(eq(feedbackResponses.tournamentId, tournamentId), eq(feedbackResponses.userId, sender.userId))).get();
  }
  if (sender.visitorResponseId === null) return undefined;
  // A player's response never opens from a cookie, only from their session.
  return database.select().from(feedbackResponses)
    .where(and(
      eq(feedbackResponses.id, sender.visitorResponseId),
      eq(feedbackResponses.tournamentId, tournamentId),
      isNull(feedbackResponses.userId),
    )).get();
}

/** Saves a new response, or replaces the sender's earlier one. Returns the response id. */
export function saveFeedback(
  database: Database,
  tournamentId: string,
  sender: FeedbackSender,
  input: FeedbackInput,
  now: number,
): string {
  return database.transaction((tx) => {
    if (!tx.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.id, tournamentId)).get()) {
      throw new Error(`Tournament ${tournamentId} not found while saving feedback.`);
    }
    const previous = findOwnFeedback(tx, tournamentId, sender);
    if (previous) {
      tx.update(feedbackResponses)
        .set({ ratings: input.ratings, comment: input.comment, updatedAt: now })
        .where(eq(feedbackResponses.id, previous.id)).run();
      return previous.id;
    }
    const id = crypto.randomUUID();
    tx.insert(feedbackResponses).values({
      id,
      tournamentId,
      userId: "userId" in sender ? sender.userId : null,
      ratings: input.ratings,
      comment: input.comment,
      createdAt: now,
      updatedAt: now,
    }).run();
    return id;
  });
}

/** Every response, newest first, without names: organisers see only player or visitor. */
export function listFeedback(database: Database, tournamentId: string): FeedbackRow[] {
  return database.select().from(feedbackResponses)
    .where(eq(feedbackResponses.tournamentId, tournamentId))
    .orderBy(desc(feedbackResponses.updatedAt), desc(feedbackResponses.id)).all()
    .map((row) => ({
      id: row.id,
      fromPlayer: row.userId !== null,
      ratings: row.ratings,
      comment: row.comment,
      updatedAt: row.updatedAt,
    }));
}
