import { and, desc, eq, isNull, ne, or } from "drizzle-orm";
import type { Database } from "./draws";
import { challengeAttempts, entries, profiles, tournaments } from "./schema";
import { isChallengeKind, parseChallengeScore, rankChallengeAttempts, type ChallengeKind } from "@/lib/challenges";
export function listChallengePlayers(database: Database, tournamentId: string) {
  return database.selectDistinct({ userId: profiles.userId, name: profiles.fullName }).from(profiles)
    .innerJoin(entries, or(eq(entries.userId, profiles.userId), and(eq(entries.partnerUserId, profiles.userId), eq(entries.partnerStatus, "accepted"))))
    .where(and(eq(entries.tournamentId, tournamentId), ne(entries.status, "cancelled"))).orderBy(profiles.fullName).all();
}
export function saveChallengeAttempt(database: Database, input: { id: string; tournamentId: string; userId: string; kind: string; value: string; admin: string }) {
  if (!isChallengeKind(input.kind)) throw new Error("Choose a challenge.");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id)) throw new Error("Reload the page before recording this attempt.");
  const kind = input.kind;
  const score = parseChallengeScore(kind, input.value);
  return database.transaction(tx => {
    if (!tx.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.id, input.tournamentId)).get()) throw new Error("Tournament not found.");
    const previous = tx.select().from(challengeAttempts).where(eq(challengeAttempts.id, input.id)).get();
    if (previous) {
      if (previous.tournamentId === input.tournamentId && previous.userId === input.userId && previous.kind === kind && previous.score === score && previous.recordedBy === input.admin) return previous;
      throw new Error("This attempt was already saved. Reload before entering a different result.");
    }
    if (!listChallengePlayers(tx, input.tournamentId).some(player => player.userId === input.userId)) throw new Error("Choose a registered player with a completed profile.");
    return tx.insert(challengeAttempts).values({ id: input.id, tournamentId: input.tournamentId, userId: input.userId, kind, score, recordedBy: input.admin, createdAt: Date.now() }).returning().get();
  });
}
export function voidChallengeAttempt(database: Database, tournamentId: string, id: string, reason: string, admin: string) {
  const note = reason.trim();
  if (note.length < 3 || note.length > 200) throw new Error("Give a reason between 3 and 200 characters.");
  const attempt = database.select().from(challengeAttempts).where(and(eq(challengeAttempts.id, id), eq(challengeAttempts.tournamentId, tournamentId))).get();
  if (!attempt) throw new Error("Attempt not found.");
  if (attempt.voidedAt !== null) return;
  database.update(challengeAttempts).set({ voidedAt: Date.now(), voidedBy: admin, voidReason: note }).where(and(eq(challengeAttempts.id, id), isNull(challengeAttempts.voidedAt))).run();
}
export function challengeLeaderboard(database: Database, tournamentId: string, kind: ChallengeKind) {
  const rows = database.select({ userId: challengeAttempts.userId, name: profiles.fullName, score: challengeAttempts.score, createdAt: challengeAttempts.createdAt })
    .from(challengeAttempts).innerJoin(profiles, eq(profiles.userId, challengeAttempts.userId))
    .where(and(eq(challengeAttempts.tournamentId, tournamentId), eq(challengeAttempts.kind, kind), isNull(challengeAttempts.voidedAt))).all();
  return rankChallengeAttempts(kind, rows);
}
export function listChallengeAttempts(database: Database, tournamentId: string, kind: ChallengeKind) {
  return database.select({ attempt: challengeAttempts, name: profiles.fullName }).from(challengeAttempts)
    .innerJoin(profiles, eq(profiles.userId, challengeAttempts.userId))
    .where(and(eq(challengeAttempts.tournamentId, tournamentId), eq(challengeAttempts.kind, kind)))
    .orderBy(desc(challengeAttempts.createdAt), desc(challengeAttempts.id)).limit(100).all();
}
