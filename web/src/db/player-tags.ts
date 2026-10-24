import { eq } from "drizzle-orm";

import type { Database } from "./draws";
import { listScoringMatches } from "./matches";
import { listTeamEntryIds } from "./partners";
import { getPlayerCard } from "./player-cards";
import { draws, tournaments } from "./schema";
import { deriveState, other } from "@/lib/match";
import { statsOfRecord, type SideStats } from "@/lib/match-stats";
import { standoutFacts, type StandoutFact } from "@/lib/player-facts";
import { teamMatches, teamSide } from "@/lib/player-matches";
import { playerTag, type PlayedMatch, type PlayerTag } from "@/lib/player-tag";
import { formatOfRecord, scoreRecordOf } from "@/lib/score-record";

/** What the story card says about a player's tournament. */
export interface PlayerStory {
  tag: PlayerTag;
  /** Empty when no match was scored point by point, or nothing stands out. */
  facts: StandoutFact[];
}

interface FinishedMatch {
  played: PlayedMatch;
  /** Both sides' numbers; null for a typed-in score, whose points are made up. */
  stats: { mine: SideStats; theirs: SideStats } | null;
}

/**
 * The finished matches the player (or their doubles team) played points in, from their side.
 * Walkovers have no points, so they are left out.
 */
function finishedMatches(database: Database, userId: string): FinishedMatch[] {
  const tournament = database.select({ id: tournaments.id }).from(tournaments).get();
  if (tournament === undefined) return [];
  const ids = new Set(listTeamEntryIds(database, userId));
  const published = new Set(
    database.select({ id: draws.id }).from(draws).where(eq(draws.status, "published")).all().map((draw) => draw.id),
  );
  const rows = listScoringMatches(database, tournament.id).filter((row) => published.has(row.match.drawId));
  return teamMatches(rows, ids).flatMap((row) => {
    const record = scoreRecordOf(row.match);
    const side = teamSide(row, ids);
    if (row.match.status !== "completed" || record === null || side === null) return [];
    const state = deriveState(record.events, formatOfRecord(record), record.firstServer);
    const stats = row.match.manualScore ? null : statsOfRecord(record);
    return [
      {
        played: {
          won: row.match.winnerEntryId !== null && ids.has(row.match.winnerEntryId),
          sets: state.sets.map((set) => ({
            mine: set.games[side],
            theirs: set.games[other(side)],
            tiebreak: set.tiebreak !== null,
          })),
        },
        stats: stats === null ? null : { mine: stats[side], theirs: stats[other(side)] },
      },
    ];
  });
}

/** The tag and standout numbers on the player's shareable card. */
export function playerStoryFor(database: Database, userId: string): PlayerStory {
  const standings = getPlayerCard(database, userId)?.tournaments.flatMap((tournament) => tournament.results) ?? [];
  const matches = finishedMatches(database, userId);
  const scored = matches.flatMap((match) => (match.stats === null ? [] : [match.stats]));
  return {
    tag: playerTag(standings, matches.map((match) => match.played)),
    facts: standoutFacts(scored.map((stats) => stats.mine), scored.map((stats) => stats.theirs)),
  };
}
