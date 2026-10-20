import { eq } from "drizzle-orm";
import type { Database } from "./draws";
import { draws, entries, playerCardShares, profiles, tournaments } from "./schema";
import { listScoringMatches } from "./matches";
import { listTeamEntryIds } from "./partners";
import { earnedCertificates } from "@/lib/certificates";
import { eventResultLabel, formatPlayerId, matchRecord } from "@/lib/player-card";
import { teamMatches, teamSide } from "@/lib/player-matches";
import { other } from "@/lib/match";
import { matchSummary, sideLabel } from "@/lib/scoring-display";

export function getPlayerCardShare(db: Database, userId: string) {
  return db.select().from(playerCardShares).where(eq(playerCardShares.userId, userId)).get() ?? null;
}
export function enablePlayerCardShare(db: Database, userId: string) {
  if (!db.select({ id: profiles.id }).from(profiles).where(eq(profiles.userId, userId)).get()) throw new Error("Complete your profile before sharing your card.");
  db.insert(playerCardShares).values({ userId, token: crypto.randomUUID(), createdAt: Date.now() }).onConflictDoNothing({ target: playerCardShares.userId }).run();
  return getPlayerCardShare(db, userId)!;
}
export function disablePlayerCardShare(db: Database, userId: string) {
  db.delete(playerCardShares).where(eq(playerCardShares.userId, userId)).run();
}
export function sharedCardOwner(db: Database, token: string) {
  return db.select({ userId: playerCardShares.userId }).from(playerCardShares).where(eq(playerCardShares.token, token)).get()?.userId ?? null;
}

/** Explicit public fields only: no email, birth date, phone, payment or account identifiers. */
export function getPlayerCard(db: Database, userId: string) {
  const profile = db.select({ name: profiles.fullName, club: profiles.club, ranking: profiles.bestRanking, plays: profiles.plays, number: profiles.playerNumber, createdAt: profiles.createdAt }).from(profiles).where(eq(profiles.userId, userId)).get();
  if (!profile) return null;
  const ids = new Set(listTeamEntryIds(db, userId));
  const publicNames = new Map(db.select({ id: entries.id, name: profiles.fullName, partnerName: entries.partnerName, partnerStatus: entries.partnerStatus }).from(entries).leftJoin(profiles, eq(profiles.userId, entries.userId)).all().map(e => [e.id, e]));
  const published = new Set(db.select({ id: draws.id }).from(draws).where(eq(draws.status, "published")).all().map(d => d.id));
  // Match the single current tournament selected by getCurrentTournament.
  const tournament = db.select().from(tournaments).get();
  const recorded = (tournament ? [tournament] : []).map(tournament => {
    const rows = listScoringMatches(db, tournament.id).filter(row => published.has(row.match.drawId));
    const mine = teamMatches(rows, ids);
    const certificates = earnedCertificates(rows, ids);
    const eventEntries = db.select({ id: entries.id, category: entries.category, status: entries.status }).from(entries).where(eq(entries.tournamentId, tournament.id)).all().filter(e => ids.has(e.id) && e.status !== "cancelled");
    const results = eventEntries.map(entry => {
      const matches = mine.filter(row => row.category === entry.category && teamSide(row, new Set([entry.id])) !== null);
      const won = certificates.some(c => c.entryId === entry.id && c.kind === "winner");
      return { category: entry.category, label: eventResultLabel(matches.map(row => row.match), entry.id, won) };
    });
    const history = mine.filter(row => row.match.status === "completed").sort((a,b) => (b.match.completedAt ?? 0) - (a.match.completedAt ?? 0)).map(row => {
      const side = teamSide(row, ids)!;
      const opponent = other(side);
      const slot = opponent === "top" ? row.match.topSlot : row.match.bottomSlot;
      const publicName = slot.kind === "entry" ? publicNames.get(slot.entryId) : null;
      const info = row[opponent];
      const opponentName = sideLabel(info ? { ...info, name: publicName?.name ?? "Player", partnerName: publicName?.partnerStatus === "accepted" ? publicName.partnerName : null } : null, slot).name;
      return { id: row.match.id, category: row.category, round: row.match.roundName, opponent: opponentName, result: row.match.winnerEntryId && ids.has(row.match.winnerEntryId) ? "Won" : "Lost", score: matchSummary(row), completedAt: row.match.completedAt };
    });
    return { name: tournament.name, results, history, certificates, record: matchRecord(mine.map(row => row.match), ids) };
  }).filter(t => t.results.length || t.history.length || t.certificates.length);
  return { name: profile.name, club: profile.club, ranking: profile.ranking, plays: profile.plays, playerId: profile.number === null ? null : formatPlayerId(profile.number, profile.createdAt), tournaments: recorded, totals: recorded.reduce((a,t) => ({ played: a.played+t.record.played, won: a.won+t.record.won, lost: a.lost+t.record.lost }), { played: 0, won: 0, lost: 0 }) };
}
export type PlayerCardData = NonNullable<ReturnType<typeof getPlayerCard>>;
