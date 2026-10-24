import { eq } from "drizzle-orm";

import type { Database } from "./draws";
import { listScoringMatches } from "./matches";
import { listTeamEntryIds } from "./partners";
import { getPlayerCard } from "./player-cards";
import { draws, tournaments } from "./schema";
import { deriveState, other } from "@/lib/match";
import { teamMatches, teamSide } from "@/lib/player-matches";
import { playerTag, type PlayedMatch, type PlayerTag } from "@/lib/player-tag";
import { formatOfRecord, scoreRecordOf } from "@/lib/score-record";

/**
 * The finished matches the player (or their doubles team) played points in, set by set
 * from their side. Walkovers have no points, so they are left out.
 */
function playedMatches(database: Database, userId: string): PlayedMatch[] {
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
    return [
      {
        won: row.match.winnerEntryId !== null && ids.has(row.match.winnerEntryId),
        sets: state.sets.map((set) => ({
          mine: set.games[side],
          theirs: set.games[other(side)],
          tiebreak: set.tiebreak !== null,
        })),
      },
    ];
  });
}

/** The tag on the player's shareable card, from how their events and matches went. */
export function playerTagFor(database: Database, userId: string): PlayerTag {
  const standings = getPlayerCard(database, userId)?.tournaments.flatMap((tournament) => tournament.results) ?? [];
  return playerTag(standings, playedMatches(database, userId));
}
