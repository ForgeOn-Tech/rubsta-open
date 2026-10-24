import type { PublicBroadcast } from "./broadcast";
import type { ChatMessage, SetCall } from "@/db/fan";
import type { ReactionKind } from "@/db/schema";
import type { FanScoreboard } from "@/lib/fan-live";
import type { PredictionTally } from "@/lib/fan-predictions";
import type { Side } from "@/lib/match";

/** How often a court page asks for the score, chat, votes and reactions. */
export const FAN_FEED_INTERVAL_MS = 5_000;
/** Where the page sends its viewer id, so one tab counts once. */
export const VIEWER_PARAM = "viewer";

export interface FanPredictionFeed {
  setNumber: number;
  open: boolean;
  tally: PredictionTally;
  /** The side this fan picked for the set, or null. */
  own: Side | null;
}

/** Everything one court page shows, refreshed together. */
export interface FanFeed {
  broadcast: PublicBroadcast | null;
  watching: number;
  live: FanScoreboard | null;
  next: { board: FanScoreboard; place: string | null } | null;
  reactions: Record<ReactionKind, number>;
  predictions: FanPredictionFeed | null;
  /** Chat for the court's current match. */
  messages: ChatMessage[];
  /** How this fan's latest finished set call went, with the set winner's name. */
  lastCall: (SetCall & { winnerName: string }) | null;
  signedIn: boolean;
}

export function fanFeedPath(courtNumber: number, viewerId: string): string {
  return `/api/fan/${courtNumber}?${VIEWER_PARAM}=${encodeURIComponent(viewerId)}`;
}
