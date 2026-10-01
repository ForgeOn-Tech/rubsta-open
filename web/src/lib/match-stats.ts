/**
 * Match statistics from the recorded events. The umpire records who won each
 * point, faults, double faults and lets, not how a point was won, so there
 * are no aces, winners or unforced errors here.
 */

import {
  SIDES,
  applyEvent,
  hasGamePoint,
  initialState,
  other,
  standardFormat,
  type MatchEvent,
  type MatchFormat,
  type MatchState,
  type Side,
} from "@/lib/match";
import type { ScoreRecord } from "@/lib/score-record";

export const ADMIN_RESULTS_PATH = "/admin/results";

/** One side's numbers. For doubles, a side is the team. */
export interface SideStats {
  pointsWon: number;
  /** Points this side served, double faults included. */
  servicePoints: number;
  firstServesIn: number;
  firstServePointsWon: number;
  secondServePoints: number;
  secondServePointsWon: number;
  doubleFaults: number;
  /** Games this side served to a finish; tiebreaks are not service games. */
  serviceGames: number;
  serviceGamesHeld: number;
  /** Points this side played with a chance to break serve. */
  breakPoints: number;
  breakPointsWon: number;
  tiebreakPointsWon: number;
  longestPointRun: number;
}

export type MatchStats = Record<Side, SideStats>;

export interface StatRow {
  label: string;
  top: string;
  bottom: string;
}

/** What happened on one finished point. */
interface PointFacts {
  server: Side;
  winner: Side;
  secondServe: boolean;
  doubleFault: boolean;
  breakPoint: boolean;
  inTiebreak: boolean;
  gameEnded: boolean;
  /** Points in a row the winner has now won. */
  runLength: number;
}

interface Tally {
  state: MatchState;
  stats: MatchStats;
  run: { side: Side; length: number } | null;
}

const NO_STATS: SideStats = {
  pointsWon: 0,
  servicePoints: 0,
  firstServesIn: 0,
  firstServePointsWon: 0,
  secondServePoints: 0,
  secondServePointsWon: 0,
  doubleFaults: 0,
  serviceGames: 0,
  serviceGamesHeld: 0,
  breakPoints: 0,
  breakPointsWon: 0,
  tiebreakPointsWon: 0,
  longestPointRun: 0,
};
const NO_VALUE = "–";
const PERCENT = 100;

function count(condition: boolean): number {
  return condition ? 1 : 0;
}

function gamesInSet(state: MatchState): number {
  return state.games.top + state.games.bottom;
}

function withPoint(stats: SideStats, side: Side, point: PointFacts): SideStats {
  const serving = side === point.server;
  const won = side === point.winner;
  const receivingBreakPoint = !serving && point.breakPoint;
  return {
    pointsWon: stats.pointsWon + count(won),
    servicePoints: stats.servicePoints + count(serving),
    firstServesIn: stats.firstServesIn + count(serving && !point.secondServe),
    firstServePointsWon: stats.firstServePointsWon + count(serving && !point.secondServe && won),
    secondServePoints: stats.secondServePoints + count(serving && point.secondServe),
    secondServePointsWon: stats.secondServePointsWon + count(serving && point.secondServe && won),
    doubleFaults: stats.doubleFaults + count(serving && point.doubleFault),
    serviceGames: stats.serviceGames + count(serving && point.gameEnded),
    serviceGamesHeld: stats.serviceGamesHeld + count(serving && point.gameEnded && won),
    breakPoints: stats.breakPoints + count(receivingBreakPoint),
    breakPointsWon: stats.breakPointsWon + count(receivingBreakPoint && won),
    tiebreakPointsWon: stats.tiebreakPointsWon + count(won && point.inTiebreak),
    longestPointRun: won ? Math.max(stats.longestPointRun, point.runLength) : stats.longestPointRun,
  };
}

function step(tally: Tally, event: MatchEvent, format: MatchFormat): Tally {
  const before = tally.state;
  const after = applyEvent(before, event, format);
  const winner =
    event.type === "point" ? event.side : event.type === "doubleFault" ? other(before.server) : null;
  // A fault or a let does not finish the point.
  if (winner === null) return { ...tally, state: after };

  const runLength = tally.run !== null && tally.run.side === winner ? tally.run.length + 1 : 1;
  const point: PointFacts = {
    server: before.server,
    winner,
    secondServe: before.faultPending || event.type === "doubleFault",
    doubleFault: event.type === "doubleFault",
    breakPoint: !before.tiebreak && hasGamePoint(before, other(before.server)),
    inTiebreak: before.tiebreak,
    gameEnded:
      !before.tiebreak &&
      (after.sets.length !== before.sets.length || gamesInSet(after) !== gamesInSet(before)),
    runLength,
  };
  return {
    state: after,
    stats: {
      top: withPoint(tally.stats.top, "top", point),
      bottom: withPoint(tally.stats.bottom, "bottom", point),
    },
    run: { side: winner, length: runLength },
  };
}

/** Statistics for both sides after replaying `events` from the first serve. */
export function matchStats(
  events: readonly MatchEvent[],
  format: MatchFormat,
  firstServer: Side,
): MatchStats {
  const start: Tally = {
    state: initialState(firstServer, format),
    stats: { top: NO_STATS, bottom: NO_STATS },
    run: null,
  };
  return events.reduce((tally, event) => step(tally, event, format), start).stats;
}

/** Statistics for a saved or kept score record. */
export function statsOfRecord(record: ScoreRecord): MatchStats {
  return matchStats(record.events, standardFormat(record.decidingSet), record.firstServer);
}

function percent(part: number, whole: number): string {
  return whole === 0 ? NO_VALUE : `${Math.round((part / whole) * PERCENT)}%`;
}

function ratio(part: number, whole: number): string {
  return `${part}/${whole}`;
}

/** Rows to show side by side. The tiebreak row appears once a tiebreak point is played. */
export function statRows(stats: MatchStats): StatRow[] {
  const row = (label: string, value: (side: SideStats) => string): StatRow => ({
    label,
    top: value(stats.top),
    bottom: value(stats.bottom),
  });
  const tiebreakPlayed = SIDES.some((side) => stats[side].tiebreakPointsWon > 0);

  return [
    row("Points won", (side) => String(side.pointsWon)),
    row("First serve in", (side) => percent(side.firstServesIn, side.servicePoints)),
    row("Won on first serve", (side) => percent(side.firstServePointsWon, side.firstServesIn)),
    row("Won on second serve", (side) => percent(side.secondServePointsWon, side.secondServePoints)),
    row("Double faults", (side) => String(side.doubleFaults)),
    row("Break points won", (side) => ratio(side.breakPointsWon, side.breakPoints)),
    row("Service games held", (side) => ratio(side.serviceGamesHeld, side.serviceGames)),
    ...(tiebreakPlayed ? [row("Tiebreak points won", (side) => String(side.tiebreakPointsWon))] : []),
    row("Longest run of points", (side) => String(side.longestPointRun)),
  ];
}
