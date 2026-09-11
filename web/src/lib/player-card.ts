import type { Match } from "@/db/schema";
import { scoreRecordOf } from "@/lib/score-record";

/** The signed-in player's card as a PNG (src/app/(player)/home/card-image/route.tsx). */
export const PLAYER_CARD_IMAGE_PATH = "/home/card-image";
export const PLAYER_CARD_FILE_NAME = "rubsta-open-player-card.png";

const PLAYER_ID_PREFIX = "FL";
const PLAYER_NUMBER_DIGITS = 4;

export interface MatchRecord {
  played: number;
  won: number;
  lost: number;
}

/** e.g. "FL-2026-0117": the year the profile was made, then the player number. */
export function formatPlayerId(playerNumber: number, profileCreatedAt: number): string {
  const year = new Date(profileCreatedAt).getUTCFullYear();
  return `${PLAYER_ID_PREFIX}-${year}-${String(playerNumber).padStart(PLAYER_NUMBER_DIGITS, "0")}`;
}

function sideEntryIds(match: Pick<Match, "topSlot" | "bottomSlot">): string[] {
  return [match.topSlot, match.bottomSlot].flatMap((slot) => (slot.kind === "entry" ? [slot.entryId] : []));
}

/**
 * Completed matches that any of `entryIds` played, and how many they won.
 * The ids cover the player's own entries and the doubles entries they joined.
 * A walkover, including a bye, has no points played, so it does not count.
 */
export function matchRecord(matches: readonly Match[], entryIds: ReadonlySet<string>): MatchRecord {
  const played = matches.filter(
    (match) =>
      match.status === "completed" &&
      scoreRecordOf(match) !== null &&
      sideEntryIds(match).some((entryId) => entryIds.has(entryId)),
  );
  const won = played.filter((match) => match.winnerEntryId !== null && entryIds.has(match.winnerEntryId)).length;
  return { played: played.length, won, lost: played.length - won };
}
