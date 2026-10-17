import { and, eq, gt, inArray, isNotNull } from "drizzle-orm";

import { setDrawStatus, type Database } from "./draws";
import { fillGroupPlaces, groupMatchRows, membersByGroup, planOfDraw } from "./groups";
import { clearMatchFanData } from "./fan";
import {
  CATEGORIES,
  draws,
  entries,
  groupPlaces,
  matches,
  profiles,
  users,
  type Category,
  type Draw,
  type DrawSlot,
  type Match,
  type MatchSlot,
} from "./schema";
import { buildBracket, buildBracketFromSlots, type BracketRound, type BracketSlot } from "@/lib/draws";
import { knockoutSlots } from "@/lib/groups";
import { deriveState, type MatchState, type Side } from "@/lib/match";
import { formatFor } from "@/lib/match-formats";
import {
  extendsScore,
  formatOfRecord,
  sameRecordFormat,
  sameScore,
  scoreRecordOf,
  type ScoreRecord,
} from "@/lib/score-record";

export interface MatchSideInfo {
  entryId: string;
  seed: number | null;
  name: string;
  partnerName: string | null;
}

export interface ScoringMatchRow {
  match: Match;
  category: Category;
  top: MatchSideInfo | null;
  bottom: MatchSideInfo | null;
}

export type SaveScoreResult =
  | { kind: "saved"; match: Match }
  | { kind: "conflict"; match: Match };

/** No match has the given id. */
export class MatchNotFoundError extends Error {
  constructor(matchId: string) {
    super(`Match ${matchId} does not exist.`);
    this.name = "MatchNotFoundError";
  }
}

/** A score breaks a rule of the match, so sending it again cannot succeed. */
export class ScoreRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScoreRejectedError";
  }
}

function slotFor(bracket: BracketSlot): MatchSlot {
  switch (bracket.kind) {
    case "entry":
      return { kind: "entry", entryId: bracket.entryId };
    case "winner":
      return { kind: "winner", matchNumber: bracket.matchNumber };
    case "group":
      return { kind: "group", group: bracket.group, place: bracket.place };
    case "bye":
      return { kind: "bye" };
  }
}

function loadMatch(database: Database, matchId: string): Match {
  const row = database.select().from(matches).where(eq(matches.id, matchId)).get();
  if (!row) throw new MatchNotFoundError(matchId);
  return row;
}

function categoryOf(database: Database, match: Match): Category {
  const draw = database.select({ category: draws.category }).from(draws).where(eq(draws.id, match.drawId)).get();
  if (!draw) throw new Error(`Match ${match.id} belongs to draw ${match.drawId}, which does not exist.`);
  return draw.category;
}

function deriveRecordState(record: ScoreRecord, matchNumber: number): MatchState {
  try {
    return deriveState(record.events, formatOfRecord(record), record.firstServer);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new ScoreRejectedError(`The score for match ${matchNumber} is not valid: ${reason}`);
  }
}

function entryIdOf(slot: MatchSlot, matchNumber: number): string {
  if (slot.kind !== "entry") {
    throw new Error(`Match ${matchNumber} has a side that is not a drawn entry.`);
  }
  return slot.entryId;
}

/**
 * One row per bracket match when a draw is published. A match against a bye
 * is created already completed, with the entry through to the next round.
 */
export function materializeMatches(database: Database, draw: Draw, slots: DrawSlot[]): void {
  if (slots.some((slot) => slot.groupNumber !== null)) {
    materializeGroupDraw(database, draw);
    return;
  }
  const lines = [...slots]
    .sort((a, b) => a.position - b.position)
    .map((slot) => ({ position: slot.position, entryId: slot.entryId, seed: slot.seed }));
  database.transaction((tx) => {
    tx.insert(matches).values(knockoutRows(draw, buildBracket(lines), 0)).run();
  });
}

/**
 * A group event's matches: every pairing in each group, then the knockout, whose first round
 * waits on group places ("Group A winner") and whose numbers follow the group matches.
 */
function materializeGroupDraw(database: Database, draw: Draw): void {
  const groups = membersByGroup(database, draw.id);
  const groupRows = groupMatchRows(draw, groups);
  const rounds = buildBracketFromSlots(knockoutSlots(planOfDraw(draw, groups.size)), groupRows.length + 1);
  database.transaction((tx) => {
    tx.insert(matches).values([...groupRows, ...knockoutRows(draw, rounds, 1)]).run();
  });
}

/** Match rows for knockout rounds, the first at `firstRoundIndex`. */
function knockoutRows(draw: Draw, rounds: readonly BracketRound[], firstRoundIndex: number) {
  return rounds.flatMap((round, index) =>
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
        roundIndex: firstRoundIndex + index,
        roundName: round.name,
        topSlot,
        bottomSlot,
        status: (entrySlot ? "completed" : "scheduled") as "completed" | "scheduled",
        winnerEntryId: entrySlot?.entryId ?? null,
        completedAt: entrySlot ? Date.now() : null,
      };
    }),
  );
}

/**
 * Moves a finished match's winner on: a group match updates its group, which may send
 * players into the knockout; a knockout winner goes to the next round, if there is one.
 */
function afterMatchCompleted(database: Database, match: Match): void {
  if (match.groupNumber !== null) {
    fillGroupPlaces(database, match.drawId, match.groupNumber, Date.now());
    return;
  }
  if (!isLastRound(database, match)) advanceWinnerToNextMatch(database, match);
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
 * Saves an umpire's whole score record if the match is still at
 * `baseVersion`, and bumps the version. On an older version, a retry of a save
 * that already landed counts as saved, and a record that only adds events to
 * the stored one is saved. Any other mismatch is a conflict that returns the
 * stored match. The first save starts the match. The save that finishes it
 * records the winner and advances them, in the same transaction.
 */
export function saveMatchScore(
  database: Database,
  matchId: string,
  baseVersion: number,
  record: ScoreRecord,
): SaveScoreResult {
  return database.transaction((tx) => {
    const row = loadMatch(tx, matchId);
    if (row.version !== baseVersion) {
      const stored = scoreRecordOf(row);
      if (stored !== null && sameScore(stored, record)) return { kind: "saved", match: row };
      // A save whose response was lost, followed by more points, arrives on an
      // old version. It only adds to what is stored, so nothing is overwritten.
      const addsToStored =
        row.status === "in_progress" && stored !== null && extendsScore(record, stored);
      if (!addsToStored) return { kind: "conflict", match: row };
    }
    if (row.status === "completed") {
      throw new ScoreRejectedError(`Match ${row.matchNumber} is already complete.`);
    }
    if (row.topSlot.kind !== "entry" || row.bottomSlot.kind !== "entry") {
      throw new ScoreRejectedError(`Match ${row.matchNumber} is waiting on an earlier result.`);
    }
    // The server decides the rules: the event and round's format to start, then the one it started with.
    const format = row.status === "scheduled" ? formatFor(categoryOf(tx, row), row.roundName) : row.format;
    if (!sameRecordFormat(record.format, format)) {
      throw new ScoreRejectedError(
        `Match ${row.matchNumber} is played to different rules from this page. Reload the page to get them.`,
      );
    }

    const state = deriveRecordState(record, row.matchNumber);
    const completed = state.status === "completed";
    const winnerSlot = state.winner === "top" ? row.topSlot : row.bottomSlot;
    const now = Date.now();
    tx.update(matches)
      .set({
        firstServer: record.firstServer,
        decidingSet: record.decidingSet,
        format,
        // The court is set when the match starts; later saves keep any change made since.
        court: row.status === "scheduled" ? record.court : row.court,
        startedAt: row.startedAt ?? record.startedAt,
        events: record.events,
        status: state.status,
        winnerEntryId: completed ? entryIdOf(winnerSlot, row.matchNumber) : null,
        completedAt: completed ? now : null,
        version: row.version + 1,
        updatedAt: now,
      })
      .where(eq(matches.id, matchId))
      .run();

    const updated = loadMatch(tx, matchId);
    if (completed) {
      afterMatchCompleted(tx, updated);
    }
    return { kind: "saved", match: updated };
  });
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
  return database.transaction((tx) => {
    const row = loadMatch(tx, matchId);
    if (row.status !== "in_progress") {
      throw new Error("Only a match in progress can be reset.");
    }
    tx.update(matches)
      .set({
        events: [],
        status: "scheduled",
        startedAt: null,
        firstServer: null,
        // Started again, it takes the event and round's format as it is then.
        format: null,
        version: row.version + 1,
        updatedAt: Date.now(),
      })
      .where(eq(matches.id, matchId))
      .run();
    // The sets fans predicted never happened, so their picks go with the score.
    clearMatchFanData(tx, matchId);
    return loadMatch(tx, matchId);
  });
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
        version: row.version + 1,
        updatedAt: now,
      })
      .where(eq(matches.id, matchId))
      .run();

    const updated = loadMatch(tx, matchId);
    afterMatchCompleted(tx, updated);
    return updated;
  });
}

/**
 * Records a walkover: the absent side never played, so the other side wins and advances.
 * Only for a match not yet started between two known entries; a match already under way
 * ends by retirement on the scoring screen instead.
 */
export function walkoverMatch(database: Database, matchId: string, absentSide: Side): Match {
  return database.transaction((tx) => {
    const row = loadMatch(tx, matchId);
    if (row.status !== "scheduled") {
      throw new ScoreRejectedError(
        `Match ${row.matchNumber} has already started. The umpire records a retirement on the scoring screen.`,
      );
    }
    if (row.topSlot.kind !== "entry" || row.bottomSlot.kind !== "entry") {
      throw new ScoreRejectedError(`Match ${row.matchNumber} is waiting on an earlier result.`);
    }
    return retireMatch(tx, matchId, absentSide);
  });
}

/** Removes every match of a draw (when it moves back to draft). */
export function deleteMatchesForDraw(database: Database, drawId: string): void {
  database.delete(groupPlaces).where(eq(groupPlaces.drawId, drawId)).run();
  database.delete(matches).where(eq(matches.drawId, drawId)).run();
}

/**
 * Publishes a draft draw and creates its matches in one transaction, so a
 * bracket that cannot be built leaves the draw in draft.
 */
export function publishDraw(database: Database, draw: Draw, slots: DrawSlot[]): void {
  database.transaction((tx) => {
    setDrawStatus(tx, draw.id, "draft", "published");
    materializeMatches(tx, draw, slots);
  });
}

/** True once any match in the draw has started, including retirements. */
export function hasPlayedMatches(database: Database, drawId: string): boolean {
  const played = database
    .select({ id: matches.id })
    .from(matches)
    .where(and(eq(matches.drawId, drawId), isNotNull(matches.startedAt)))
    .get();
  return played !== undefined;
}

/**
 * Moves a published draw back to draft and deletes its matches, in one
 * transaction. Refuses once play has started, so no score is lost.
 */
export function unpublishDraw(database: Database, drawId: string): void {
  database.transaction((tx) => {
    if (hasPlayedMatches(tx, drawId)) {
      throw new Error(`Draw ${drawId} has matches that have started.`);
    }
    deleteMatchesForDraw(tx, drawId);
    setDrawStatus(tx, drawId, "published", "draft");
  });
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

function scoringRow(
  match: Match,
  category: Category,
  infos: Map<string, MatchSideInfo>,
): ScoringMatchRow {
  return {
    match,
    category,
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
  return rows.map((row) => scoringRow(row.match, row.draw.category, infos));
}

/** One match with its side details, or null when the id does not exist. */
export function getScoringMatch(database: Database, matchId: string): ScoringMatchRow | null {
  const row = database
    .select({ match: matches, draw: draws })
    .from(matches)
    .innerJoin(draws, eq(matches.drawId, draws.id))
    .where(eq(matches.id, matchId))
    .get();
  if (!row) return null;
  return scoringRow(
    row.match,
    row.draw.category,
    sideInfosFor(database, [row.match.topSlot, row.match.bottomSlot]),
  );
}
