/**
 * Pure tennis match engine. A match is a fold over an append-only list of
 * events, so undo is "drop the last event and re-derive" and the stored row
 * never needs a mutable score snapshot. Sides are "top"/"bottom"; player
 * names, seeds and doubles pairings are a display concern (lib/match-display).
 */

export type Side = "top" | "bottom";
export const SIDES: readonly Side[] = ["top", "bottom"];

export function other(side: Side): Side {
  return side === "top" ? "bottom" : "top";
}

export type DecidingSet = "set" | "matchTiebreak";

export interface MatchFormat {
  /** Sets needed to win the match (best of 2n − 1). */
  setsToWin: number;
  /** Games needed for a set; at games-a-side a tiebreak decides it. */
  gamesPerSet: number;
  /** Points needed in a regular tiebreak, won by two. */
  tiebreakPoints: number;
  /** "matchTiebreak": the deciding set is a 10-point tiebreak, not games. */
  decidingSet: DecidingSet;
}

/** Points needed in a match tiebreak (the "10-point tiebreak"), won by two. */
export const MATCH_TIEBREAK_POINTS = 10;

/** Club default: best of 3 sets, 6 games, 7-point tiebreaks at 6–6. */
export function standardFormat(decidingSet: DecidingSet = "set"): MatchFormat {
  return { setsToWin: 2, gamesPerSet: 6, tiebreakPoints: 7, decidingSet };
}

export type MatchEvent =
  | { type: "point"; side: Side }
  | { type: "fault" }
  | { type: "doubleFault" }
  | { type: "let" };

export interface CompletedSet {
  games: Record<Side, number>;
  /** Both sides' tiebreak points when the set ended in a tiebreak, else null. */
  tiebreak: Record<Side, number> | null;
}

export type MatchStatus = "in_progress" | "completed";

export interface MatchState {
  sets: CompletedSet[];
  /** Games in the current set. */
  games: Record<Side, number>;
  /** Points in the current game: 0–3 (0/15/30/40) or tiebreak integers. */
  points: Record<Side, number>;
  /** The current game is a tiebreak. */
  tiebreak: boolean;
  /** Points needed for the current tiebreak (7, or 10 in a match tiebreak). */
  tiebreakTarget: number | null;
  /** Who served the first point of the current tiebreak, else null. */
  tiebreakServer: Side | null;
  server: Side;
  /** First serve missed; the next fault or rally decides the point. */
  faultPending: boolean;
  status: MatchStatus;
  winner: Side | null;
  doubleFaults: Record<Side, number>;
  breakPointChances: Record<Side, number>;
  breakPointsWon: Record<Side, number>;
}

function zeroScore(): Record<Side, number> {
  return { top: 0, bottom: 0 };
}

export function initialState(firstServer: Side, format: MatchFormat): MatchState {
  const state: MatchState = {
    sets: [],
    games: zeroScore(),
    points: zeroScore(),
    tiebreak: false,
    tiebreakTarget: null,
    tiebreakServer: null,
    server: firstServer,
    faultPending: false,
    status: "in_progress",
    winner: null,
    doubleFaults: zeroScore(),
    breakPointChances: zeroScore(),
    breakPointsWon: zeroScore(),
  };
  if (isDecidingTiebreakSet(0, format)) startTiebreak(state, MATCH_TIEBREAK_POINTS);
  return state;
}

/** The next game is a tiebreak to `target`, served first by the side due to serve. */
function startTiebreak(state: MatchState, target: number): void {
  state.tiebreak = true;
  state.tiebreakTarget = target;
  state.tiebreakServer = state.server;
}

/** Tiebreak serve order: the first server serves point 1, then two points each. */
function tiebreakServerFor(pointNumber: number, firstServer: Side): Side {
  return Math.floor(pointNumber / 2) % 2 === 0 ? firstServer : other(firstServer);
}

/** The set after `setsPlayed` completed sets is the deciding match tiebreak. */
function isDecidingTiebreakSet(setsPlayed: number, format: MatchFormat): boolean {
  return format.decidingSet === "matchTiebreak" && setsPlayed === format.setsToWin * 2 - 2;
}

export function setsWon(state: MatchState, side: Side): number {
  return state.sets.filter((set) => set.games[side] > set.games[other(side)]).length;
}

/** True when `side` is one point from taking the current game. */
export function hasGamePoint(state: MatchState, side: Side): boolean {
  return state.points[side] >= 3 && state.points[side] > state.points[other(side)];
}

function pointWinsGame(points: Record<Side, number>, side: Side): boolean {
  // 40 counts as 3; a game needs four points and a two-point lead.
  return points[side] >= 4 && points[side] - points[other(side)] >= 2;
}

function pointWinsTiebreak(points: Record<Side, number>, side: Side, target: number): boolean {
  return points[side] >= target && points[side] - points[other(side)] >= 2;
}

function gameWinsSet(games: Record<Side, number>, side: Side, format: MatchFormat): boolean {
  return (
    games[side] >= format.gamesPerSet && games[side] - games[other(side)] >= 2
  );
}

/** Award a point to `side`: break-point stats, game/set/match completion. */
function awardPoint(state: MatchState, side: Side, format: MatchFormat): void {
  if (!state.tiebreak) {
    const receiver = other(state.server);
    if (hasGamePoint(state, receiver)) {
      state.breakPointChances[receiver] += 1;
      if (side === receiver) state.breakPointsWon[receiver] += 1;
    }
  }

  state.points[side] += 1;
  state.faultPending = false;

  if (state.tiebreak) {
    if (!pointWinsTiebreak(state.points, side, state.tiebreakTarget ?? 7)) {
      if (state.tiebreakServer === null) {
        throw new Error("A tiebreak is in play without a recorded first server.");
      }
      const nextPoint = state.points.top + state.points.bottom + 1;
      state.server = tiebreakServerFor(nextPoint, state.tiebreakServer);
      return;
    }
    // The tiebreak game is the set: record it 7–6 with the tiebreak points.
    state.sets.push({
      games: {
        top: format.gamesPerSet + (side === "top" ? 1 : 0),
        bottom: format.gamesPerSet + (side === "bottom" ? 1 : 0),
      },
      tiebreak: { ...state.points },
    });
    afterSet(state, side, format);
    return;
  }

  if (!pointWinsGame(state.points, side)) return;
  state.games[side] += 1;
  state.points = zeroScore();

  if (gameWinsSet(state.games, side, format)) {
    state.sets.push({ games: { ...state.games }, tiebreak: null });
    afterSet(state, side, format);
    return;
  }

  // The serve alternates every game, whoever won it, into a tiebreak too.
  state.server = other(state.server);
  if (state.games.top === format.gamesPerSet && state.games.bottom === format.gamesPerSet) {
    // 6–6: the next game is a tiebreak.
    startTiebreak(
      state,
      isDecidingTiebreakSet(state.sets.length, format) ? MATCH_TIEBREAK_POINTS : format.tiebreakPoints,
    );
  }
}

/** After a set lands: match win, or start the next set (match tiebreak or games). */
function afterSet(state: MatchState, side: Side, format: MatchFormat): void {
  // After a tiebreak, the side that received its first point serves next.
  state.server = other(state.tiebreakServer ?? state.server);
  state.games = zeroScore();
  state.points = zeroScore();
  state.tiebreak = false;
  state.tiebreakTarget = null;
  state.tiebreakServer = null;

  if (setsWon(state, side) === format.setsToWin) {
    state.status = "completed";
    state.winner = side;
    return;
  }
  if (isDecidingTiebreakSet(state.sets.length, format)) {
    startTiebreak(state, MATCH_TIEBREAK_POINTS);
  }
}

export function applyEvent(
  state: MatchState,
  event: MatchEvent,
  format: MatchFormat,
): MatchState {
  if (state.status === "completed") {
    throw new Error("The match is already complete.");
  }
  const next: MatchState = {
    ...state,
    games: { ...state.games },
    points: { ...state.points },
    doubleFaults: { ...state.doubleFaults },
    breakPointChances: { ...state.breakPointChances },
    breakPointsWon: { ...state.breakPointsWon },
  };
  switch (event.type) {
    case "point":
      awardPoint(next, event.side, format);
      return next;
    case "fault":
      next.faultPending = true;
      return next;
    case "doubleFault":
      next.doubleFaults[next.server] += 1;
      awardPoint(next, other(next.server), format);
      return next;
    case "let":
      return next;
  }
}

/** The match state after replaying `events` from a new match. */
export function deriveState(
  events: readonly MatchEvent[],
  format: MatchFormat,
  firstServer: Side,
): MatchState {
  return events.reduce((state, event) => applyEvent(state, event, format), initialState(firstServer, format));
}

// ── Display helpers ─────────────────────────────────────────────────────────

const GAME_POINT_LABELS = ["0", "15", "30", "40"] as const;

/** "0"/"15"/"30"/"40", "Ad", or tiebreak integers. */
export function pointLabel(state: MatchState, side: Side): string {
  const points = state.points[side];
  if (state.tiebreak) return String(points);
  if (points <= 3) return GAME_POINT_LABELS[points];
  return points > state.points[other(side)] ? "Ad" : "40";
}

/** True during a deuce game (40–40 or deeper, not a tiebreak). */
export function isDeuce(state: MatchState): boolean {
  return !state.tiebreak && state.points.top >= 3 && state.points.top === state.points.bottom;
}

/** The side with advantage during a deuce game, else null. */
export function advantageSide(state: MatchState): Side | null {
  if (state.tiebreak || state.points.top === state.points.bottom) return null;
  if (state.points.top < 4 && state.points.bottom < 4) return null;
  return state.points.top > state.points.bottom ? "top" : "bottom";
}

/** Game number within the current set (1-based), e.g. 3–2 → game 6. */
export function currentGameNumber(state: MatchState): number {
  return state.games.top + state.games.bottom + 1;
}

/** Ends change after odd-numbered games within a set. */
export function changeEndsAfterThisGame(state: MatchState): boolean {
  return currentGameNumber(state) % 2 === 1;
}

/**
 * Per-side set scores for a scoreboard row: game counts per completed set,
 * then the current set's games. Tiebreak sets show the loser's points in
 * parentheses: [7, "6(5)"] for a 7–6(5) set.
 */
export function setScores(state: MatchState): Record<Side, string[]> {
  const scores: Record<Side, string[]> = { top: [], bottom: [] };
  for (const set of state.sets) {
    const winner: Side = set.games.top > set.games.bottom ? "top" : "bottom";
    for (const side of SIDES) {
      const games = String(set.games[side]);
      scores[side].push(
        set.tiebreak && side !== winner ? `${games}(${set.tiebreak[side]})` : games,
      );
    }
  }
  scores.top.push(String(state.games.top));
  scores.bottom.push(String(state.games.bottom));
  return scores;
}
