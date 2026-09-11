import { and, eq, gt, inArray } from "drizzle-orm";

import type { Database } from "./draws";
import {
  CATEGORIES,
  draws,
  entries,
  matches,
  profiles,
  users,
  type Category,
  type Draw,
  type DrawSlot,
  type Match,
  type MatchSlot,
} from "./schema";
import { buildBracket, type BracketSlot } from "@/lib/draws";
import {
  deriveState,
  standardFormat,
  type DecidingSet,
  type MatchEvent,
  type Side,
} from "@/lib/match";

export interface MatchSideInfo {
  entryId: string;
  seed: number | null;
  name: string;
  partnerName: string | null;
}

export interface ScoringMatchRow {
  match: Match;
  top: MatchSideInfo | null;
  bottom: MatchSideInfo | null;
}

function slotFor(bracket: BracketSlot): MatchSlot {
  switch (bracket.kind) {
    case "entry":
      return { kind: "entry", entryId: bracket.entryId };
    case "winner":
      return { kind: "winner", matchNumber: bracket.matchNumber };
    case "bye":
      return { kind: "bye" };
  }
}

function loadMatch(database: Database, matchId: string): Match {
  const row = database.select().from(matches).where(eq(matches.id, matchId)).get();
  if (!row) throw new Error(`Match ${matchId} does not exist.`);
  return row;
}

/**
 * One row per bracket match when a draw is published. A match against a bye
 * is created already completed, with the entry through to the next round.
 */
export function materializeMatches(database: Database, draw: Draw, slots: DrawSlot[]): void {
  const lines = [...slots]
    .sort((a, b) => a.position - b.position)
    .map((slot) => ({ position: slot.position, entryId: slot.entryId, seed: slot.seed }));
  const rounds = buildBracket(lines);

  const values = rounds.flatMap((round, roundIndex) =>
    round.matches.map((match) => {
      const topSlot = slotFor(match.top);
      const bottomSlot = slotFor(match.bottom);
      if (topSlot.kind === "bye" && bottomSlot.kind === "bye") {
        throw new Error(`Match ${match.number} has two byes.`);
      }
      const entrySlot =
        topSlot.kind === "bye" && bottomSlot.kind === "entry"
          ? bottomSlot
          : bottomSlot.kind === "bye" && topSlot.kind === "entry"
            ? topSlot
            : null;
      return {
        drawId: draw.id,
        matchNumber: match.number,
        roundIndex,
        roundName: round.name,
        topSlot,
        bottomSlot,
        status: (entrySlot ? "completed" : "scheduled") as "completed" | "scheduled",
        winnerEntryId: entrySlot?.entryId ?? null,
        completedAt: entrySlot ? Date.now() : null,
      };
    }),
  );

  database.transaction((tx) => {
    tx.insert(matches).values(values).run();
  });
}

/** True when no later round follows `match`, so its winner has nowhere to go. */
function isLastRound(database: Database, match: Match): boolean {
  const later = database
    .select({ id: matches.id })
    .from(matches)
    .where(and(eq(matches.drawId, match.drawId), gt(matches.roundIndex, match.roundIndex)))
    .get();
  return later === undefined;
}

/**
 * After `match` finishes, drops its winner into the winner slot of the next
 * round's match that waits on it.
 */
export function advanceWinnerToNextMatch(database: Database, match: Match): void {
  if (match.winnerEntryId === null) {
    throw new Error(`Match ${match.matchNumber} has no winner to advance.`);
  }
  const target = database
    .select()
    .from(matches)
    .where(eq(matches.drawId, match.drawId))
    .all()
    .find(
      (row) =>
        row.id !== match.id &&
        ((row.topSlot.kind === "winner" && row.topSlot.matchNumber === match.matchNumber) ||
          (row.bottomSlot.kind === "winner" && row.bottomSlot.matchNumber === match.matchNumber)),
    );
  if (!target) {
    throw new Error(`No match in draw ${match.drawId} waits on match ${match.matchNumber}.`);
  }

  const fillsTop =
    target.topSlot.kind === "winner" && target.topSlot.matchNumber === match.matchNumber;
  const nextSlot: MatchSlot = { kind: "entry", entryId: match.winnerEntryId };
  database
    .update(matches)
    .set(fillsTop ? { topSlot: nextSlot, updatedAt: Date.now() } : { bottomSlot: nextSlot, updatedAt: Date.now() })
    .where(eq(matches.id, target.id))
    .run();
}

/**
 * Appends one scoring event and persists the re-derived state. Completing
 * the match records the winner and advances them, in one transaction.
 */
export function appendMatchEvent(database: Database, matchId: string, event: MatchEvent): Match {
  return database.transaction((tx) => {
    const row = loadMatch(tx, matchId);
    if (row.status === "completed") throw new Error("The match is already complete.");
    if (row.status !== "in_progress" || row.firstServer === null) {
      throw new Error("Start the match first.");
    }

    const events = [...row.events, event];
    const state = deriveState(events, standardFormat(row.decidingSet), row.firstServer);
    let winnerEntryId: string | null = null;
    let completedAt: number | null = null;
    if (state.status === "completed") {
      const winnerSlot = row[state.winner === "top" ? "topSlot" : "bottomSlot"];
      if (winnerSlot.kind !== "entry") {
        throw new Error("The winning side is not a drawn entry.");
      }
      winnerEntryId = winnerSlot.entryId;
      completedAt = Date.now();
    }

    tx.update(matches)
      .set({ events, status: state.status, winnerEntryId, completedAt, updatedAt: Date.now() })
      .where(eq(matches.id, matchId))
      .run();

    const updated = loadMatch(tx, matchId);
    if (state.status === "completed" && !isLastRound(tx, updated)) {
      advanceWinnerToNextMatch(tx, updated);
    }
    return updated;
  });
}

/** Drops the last scoring event, re-scheduling a match left with none. */
export function undoLastMatchEvent(database: Database, matchId: string): Match {
  return database.transaction((tx) => {
    const row = loadMatch(tx, matchId);
    if (row.status === "completed") throw new Error("The match is already complete.");
    if (row.events.length === 0) throw new Error("Nothing to undo.");

    const events = row.events.slice(0, -1);
    tx.update(matches)
      .set({
        events,
        status: events.length === 0 ? "scheduled" : "in_progress",
        startedAt: events.length === 0 ? null : row.startedAt,
        updatedAt: Date.now(),
      })
      .where(eq(matches.id, matchId))
      .run();
    return loadMatch(tx, matchId);
  });
}

/**
 * Moves a scheduled match to in progress. Both sides must be drawn entries,
 * so a match waiting on an earlier result cannot be scored yet.
 */
export function startMatch(
  database: Database,
  matchId: string,
  input: { firstServer: Side; court: number | null; decidingSet: DecidingSet },
): Match {
  const row = loadMatch(database, matchId);
  if (row.status !== "scheduled") throw new Error("The match has already started.");
  if (row.topSlot.kind !== "entry" || row.bottomSlot.kind !== "entry") {
    throw new Error("Both players must be known before scoring.");
  }
  database
    .update(matches)
    .set({
      firstServer: input.firstServer,
      court: input.court,
      decidingSet: input.decidingSet,
      status: "in_progress",
      startedAt: Date.now(),
      updatedAt: Date.now(),
    })
    .where(eq(matches.id, matchId))
    .run();
  return loadMatch(database, matchId);
}

/** Assigns or clears the court for a match. */
export function setMatchCourt(database: Database, matchId: string, court: number | null): void {
  database
    .update(matches)
    .set({ court, updatedAt: Date.now() })
    .where(eq(matches.id, matchId))
    .run();
}

/**
 * Clears scoring back to a scheduled match. Completed matches are final and
 * can never be reset.
 */
export function resetMatch(database: Database, matchId: string): Match {
  const row = loadMatch(database, matchId);
  if (row.status !== "in_progress") {
    throw new Error("Only a match in progress can be reset.");
  }
  database
    .update(matches)
    .set({
      events: [],
      status: "scheduled",
      startedAt: null,
      firstServer: null,
      updatedAt: Date.now(),
    })
    .where(eq(matches.id, matchId))
    .run();
  return loadMatch(database, matchId);
}

/**
 * Ends a match by retirement: the other side wins and advances. A scheduled
 * match gains a start time so elapsed time still reads sensibly.
 */
export function retireMatch(database: Database, matchId: string, retiringSide: Side): Match {
  return database.transaction((tx) => {
    const row = loadMatch(tx, matchId);
    if (row.status === "completed") throw new Error("The match is already complete.");
    const winnerSlot = row[retiringSide === "top" ? "bottomSlot" : "topSlot"];
    if (winnerSlot.kind !== "entry") {
      throw new Error("The other side is not a drawn entry.");
    }

    const now = Date.now();
    tx.update(matches)
      .set({
        status: "completed",
        winnerEntryId: winnerSlot.entryId,
        startedAt: row.startedAt ?? now,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(matches.id, matchId))
      .run();

    const updated = loadMatch(tx, matchId);
    if (!isLastRound(tx, updated)) advanceWinnerToNextMatch(tx, updated);
    return updated;
  });
}

/** Removes every match of a draw (when it moves back to draft). */
export function deleteMatchesForDraw(database: Database, drawId: string): void {
  database.delete(matches).where(eq(matches.drawId, drawId)).run();
}

/** Player details for each `{ kind: "entry" }` slot among `slots`. */
function sideInfosFor(database: Database, slots: MatchSlot[]): Map<string, MatchSideInfo> {
  const entryIds = [...new Set(
    slots.filter((slot) => slot.kind === "entry").map((slot) => slot.entryId),
  )];
  if (entryIds.length === 0) return new Map();
  const rows = database
    .select({ entry: entries, user: users, profile: profiles })
    .from(entries)
    .innerJoin(users, eq(entries.userId, users.id))
    .leftJoin(profiles, eq(profiles.userId, entries.userId))
    .where(inArray(entries.id, entryIds))
    .all();
  return new Map(
    rows.map(({ entry, user, profile }) => [
      entry.id,
      {
        entryId: entry.id,
        seed: entry.seed,
        name: profile?.fullName ?? user.name ?? user.email,
        partnerName: entry.partnerName,
      },
    ]),
  );
}

function scoringRow(match: Match, infos: Map<string, MatchSideInfo>): ScoringMatchRow {
  return {
    match,
    top: match.topSlot.kind === "entry" ? (infos.get(match.topSlot.entryId) ?? null) : null,
    bottom:
      match.bottomSlot.kind === "entry" ? (infos.get(match.bottomSlot.entryId) ?? null) : null,
  };
}

/**
 * Every match of a tournament's draws with each side's player details, for
 * the scoring screen: event in enum order, then latest round first.
 */
export function listScoringMatches(database: Database, tournamentId: string): ScoringMatchRow[] {
  const rows = database
    .select({ match: matches, draw: draws })
    .from(matches)
    .innerJoin(draws, eq(matches.drawId, draws.id))
    .where(eq(draws.tournamentId, tournamentId))
    .all();
  if (rows.length === 0) return [];

  const infos = sideInfosFor(
    database,
    rows.flatMap((row) => [row.match.topSlot, row.match.bottomSlot]),
  );
  const categoryOrder = new Map<Category, number>(
    CATEGORIES.map((category, index) => [category, index]),
  );
  rows.sort((a, b) => {
    const byCategory = categoryOrder.get(a.draw.category)! - categoryOrder.get(b.draw.category)!;
    if (byCategory !== 0) return byCategory;
    if (a.match.roundIndex !== b.match.roundIndex) return b.match.roundIndex - a.match.roundIndex;
    return a.match.matchNumber - b.match.matchNumber;
  });
  return rows.map((row) => scoringRow(row.match, infos));
}

/** One match with its side details, or null when the id does not exist. */
export function getScoringMatch(database: Database, matchId: string): ScoringMatchRow | null {
  const row = database.select().from(matches).where(eq(matches.id, matchId)).get();
  if (!row) return null;
  return scoringRow(row, sideInfosFor(database, [row.topSlot, row.bottomSlot]));
}
