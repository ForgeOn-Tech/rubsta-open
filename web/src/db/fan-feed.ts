import type { Database } from "./draws";
import {
  countPredictions,
  countReactions,
  getOwnPrediction,
  listCourtMessages,
  listOwnReactions,
} from "./fan";
import { listScoringMatches } from "./matches";
import { listPublishedDays } from "./schedule";
import { REACTION_KINDS, type ReactionKind } from "./schema";
import type { FanFeed } from "@/lib/fan-feed";
import { liveOnCourt, nextOnCourt, scoreboard } from "@/lib/fan-live";
import { tally } from "@/lib/fan-predictions";
import { placeLabel, publishedPlaces, type PublishedPlace } from "@/lib/schedule";

function noReactions(): Record<ReactionKind, number> {
  return Object.fromEntries(REACTION_KINDS.map((kind) => [kind, 0])) as Record<ReactionKind, number>;
}

/**
 * Everything one court's Fan Zone page shows. The page renders it once and
 * then polls for it, so both go through here and cannot drift apart.
 */
export function fanFeed(
  database: Database,
  input: { tournamentId: string | null; courtNumber: number; userId: string | null; watching: number },
): FanFeed {
  const { tournamentId, courtNumber, userId, watching } = input;
  const rows = tournamentId === null ? [] : listScoringMatches(database, tournamentId);
  const places =
    tournamentId === null
      ? new Map<string, PublishedPlace>()
      : publishedPlaces(
          listPublishedDays(database, tournamentId),
          new Map(rows.map((row) => [row.match.id, row.match.matchNumber])),
        );

  const liveRow = liveOnCourt(rows, courtNumber);
  const nextRow = nextOnCourt(rows, places, courtNumber);
  const live = liveRow === null ? null : scoreboard(liveRow);
  const nextPlace = nextRow === null ? undefined : places.get(nextRow.match.id);

  return {
    watching,
    live,
    next:
      nextRow === null
        ? null
        : { board: scoreboard(nextRow), place: nextPlace === undefined ? null : placeLabel(nextPlace) },
    reactions: liveRow === null ? noReactions() : countReactions(database, liveRow.match.id),
    ownReactions:
      liveRow === null || userId === null ? [] : listOwnReactions(database, liveRow.match.id, userId),
    predictions:
      live === null || live.setNumber === null
        ? null
        : {
            setNumber: live.setNumber,
            open: live.predictionsOpen,
            tally: tally(countPredictions(database, live.matchId, live.setNumber)),
            own: userId === null ? null : getOwnPrediction(database, live.matchId, live.setNumber, userId),
          },
    messages: tournamentId === null ? [] : listCourtMessages(database, tournamentId, courtNumber),
    signedIn: userId !== null,
  };
}
