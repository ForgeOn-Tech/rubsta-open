"use server";

import { requireScorer } from "@/auth/require";
import { getDb } from "@/db/client";
import { resetMatch, retireMatch } from "@/db/matches";
import { SIDES, type Side } from "@/lib/match";
import { snapshotOf, type MatchSnapshot } from "@/lib/score-sync";

/** Ends a match because `retiringSide` retired; the other side wins. Online only. */
export async function retireMatchAction(matchId: string, retiringSide: Side): Promise<MatchSnapshot> {
  await requireScorer();
  if (!SIDES.includes(retiringSide)) {
    throw new Error(`Unknown side "${String(retiringSide)}" for match ${matchId}.`);
  }
  return snapshotOf(retireMatch(getDb(), matchId, retiringSide));
}

/** Clears a match in progress back to scheduled. Online only. */
export async function resetMatchAction(matchId: string): Promise<MatchSnapshot> {
  await requireScorer();
  return snapshotOf(resetMatch(getDb(), matchId));
}
