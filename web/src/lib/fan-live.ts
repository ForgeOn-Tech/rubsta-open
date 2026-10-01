import type { ScoringMatchRow } from "@/db/matches";
import type { Category, Court, MatchStatus } from "@/db/schema";
import { currentSetNumber, predictionsOpen } from "@/lib/fan-predictions";
import { deriveState, pointLabel, setScores, standardFormat, type Side } from "@/lib/match";
import type { PublishedPlace } from "@/lib/schedule";
import { snapshotOf } from "@/lib/score-sync";
import { matchSummary, sideLabel, situationLabel } from "@/lib/scoring-display";

/** One side of a match as the Fan Zone shows it. */
export interface FanSide {
  name: string;
  seed: number | null;
  /** Games in each set, finished sets first, e.g. ["6", "3"]. */
  sets: string[];
  /** The current game's score, such as "40" or "Ad", or null between matches. */
  point: string | null;
  serving: boolean;
  winner: boolean;
}

export interface FanScoreboard {
  matchId: string;
  matchNumber: number;
  category: Category;
  roundName: string;
  status: MatchStatus;
  sides: Record<Side, FanSide>;
  /** "Deuce", "Tiebreak · Second serve" and the like, or null. */
  situation: string | null;
  /** The one-line score, or null before a match starts. */
  summary: string | null;
  /** The set fans are predicting, or null when no set is being played. */
  setNumber: number | null;
  predictionsOpen: boolean;
}

/** The match on a court now, and what follows it there. */
export interface CourtView {
  court: Court;
  live: ScoringMatchRow | null;
  next: ScoringMatchRow | null;
}

function emptySide(row: ScoringMatchRow, side: Side): FanSide {
  const label = sideLabel(side === "top" ? row.top : row.bottom, side === "top" ? row.match.topSlot : row.match.bottomSlot);
  return { name: label.name, seed: label.seed, sets: [], point: null, serving: false, winner: false };
}

/**
 * A match as the Fan Zone shows it: names, sets, the current point and what
 * is happening in the game. Matches that have not started show names only.
 */
export function scoreboard(row: ScoringMatchRow): FanScoreboard {
  const { match } = row;
  const labels = { top: emptySide(row, "top"), bottom: emptySide(row, "bottom") };
  const base = {
    matchId: match.id,
    matchNumber: match.matchNumber,
    category: row.category,
    roundName: match.roundName,
    status: match.status,
    summary: matchSummary(row),
  };

  const record = snapshotOf(match).record;
  if (record === null) {
    return { ...base, sides: labels, situation: null, setNumber: null, predictionsOpen: false };
  }

  const state = deriveState(record.events, standardFormat(record.decidingSet), record.firstServer);
  const cells = setScores(state);
  const shown = state.status === "completed" ? state.sets.length : cells.top.length;
  const sides: Record<Side, FanSide> = {
    top: {
      ...labels.top,
      sets: cells.top.slice(0, shown),
      point: state.status === "completed" ? null : pointLabel(state, "top"),
      serving: state.status !== "completed" && state.server === "top",
      winner: state.winner === "top",
    },
    bottom: {
      ...labels.bottom,
      sets: cells.bottom.slice(0, shown),
      point: state.status === "completed" ? null : pointLabel(state, "bottom"),
      serving: state.status !== "completed" && state.server === "bottom",
      winner: state.winner === "bottom",
    },
  };

  return {
    ...base,
    sides,
    situation: situationLabel(state, { top: labels.top, bottom: labels.bottom }),
    setNumber: state.status === "completed" ? null : currentSetNumber(state),
    predictionsOpen: match.status === "in_progress" && predictionsOpen(state),
  };
}

/** The match being played on a court, from the court an umpire started it on. */
export function liveOnCourt(rows: readonly ScoringMatchRow[], courtNumber: number): ScoringMatchRow | null {
  return (
    rows.find((row) => row.match.status === "in_progress" && row.match.court === courtNumber) ?? null
  );
}

/**
 * The next match due on a court, from the published order of play. A match
 * has no court of its own until an umpire starts it, so this is where "up
 * next" comes from.
 */
export function nextOnCourt(
  rows: readonly ScoringMatchRow[],
  places: ReadonlyMap<string, PublishedPlace>,
  courtNumber: number,
): ScoringMatchRow | null {
  const waiting = rows
    .flatMap((row) => {
      const place = places.get(row.match.id);
      if (place === undefined || place.courtNumber !== courtNumber) return [];
      return row.match.status === "scheduled" ? [{ row, place }] : [];
    })
    .sort((a, b) => a.place.day.localeCompare(b.place.day) || a.place.position - b.place.position);
  return waiting[0]?.row ?? null;
}

/** Every court with what is on it now and what follows, in court order. */
export function courtViews(
  courts: readonly Court[],
  rows: readonly ScoringMatchRow[],
  places: ReadonlyMap<string, PublishedPlace>,
): CourtView[] {
  return courts.map((court) => ({
    court,
    live: liveOnCourt(rows, court.number),
    next: nextOnCourt(rows, places, court.number),
  }));
}
