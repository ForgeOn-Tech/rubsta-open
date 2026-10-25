import { getDb } from "./client";
import { listCourts } from "./courts";
import { listScoringMatches } from "./matches";
import { getCurrentTournament } from "./queries";
import { liveOnCourt, scoreboard } from "@/lib/fan-live";
import { MAX_COURT } from "@/lib/score-record";

/** Public display data only. OBS does not need a signed-in account. */
export function courtOverlay(value: string) {
  const courtNumber = Number(value);
  if (!Number.isInteger(courtNumber) || courtNumber < 1 || courtNumber > MAX_COURT) return null;
  const tournament = getCurrentTournament();
  if (!tournament) return null;
  const database = getDb();
  const court = listCourts(database, tournament.id).find(item => item.number === courtNumber);
  if (!court) return null;
  const row = liveOnCourt(listScoringMatches(database, tournament.id), courtNumber);
  return { courtNumber, tournamentName: tournament.name, board: row ? scoreboard(row) : null };
}
