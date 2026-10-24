import type { SideStats } from "@/lib/match-stats";

/** One standout number on the story card, e.g. value "8", label "points in a row". */
export interface StandoutFact {
  value: string;
  label: string;
}

const MAX_FACTS = 3;
const PERCENT = 100;
const MIN_POINT_RUN = 6;
const MIN_BREAKS = 2;
const MIN_ACES = 2;
const MIN_WINNERS = 5;
const MIN_SERVICE_GAMES = 4;
const MIN_HOLD_SHARE = 0.75;
const MIN_SERVICE_POINTS = 20;
const MIN_FIRST_SERVE_SHARE = 0.65;
const MIN_POINTS_PLAYED = 30;
const MIN_POINT_SHARE = 0.55;

/** Every match's numbers added together; the longest run is the best single run. */
function combined(matches: readonly SideStats[], opponents: readonly SideStats[]): { mine: SideStats; pointsPlayed: number } {
  const mine = matches.reduce((total, match) => ({
    pointsWon: total.pointsWon + match.pointsWon,
    detailsRecorded: total.detailsRecorded + match.detailsRecorded,
    aces: total.aces + match.aces,
    winners: total.winners + match.winners,
    errors: total.errors + match.errors,
    servicePoints: total.servicePoints + match.servicePoints,
    firstServesIn: total.firstServesIn + match.firstServesIn,
    firstServePointsWon: total.firstServePointsWon + match.firstServePointsWon,
    secondServePoints: total.secondServePoints + match.secondServePoints,
    secondServePointsWon: total.secondServePointsWon + match.secondServePointsWon,
    doubleFaults: total.doubleFaults + match.doubleFaults,
    serviceGames: total.serviceGames + match.serviceGames,
    serviceGamesHeld: total.serviceGamesHeld + match.serviceGamesHeld,
    breakPoints: total.breakPoints + match.breakPoints,
    breakPointsWon: total.breakPointsWon + match.breakPointsWon,
    tiebreakPointsWon: total.tiebreakPointsWon + match.tiebreakPointsWon,
    longestPointRun: Math.max(total.longestPointRun, match.longestPointRun),
  }));
  const opponentPoints = opponents.reduce((sum, match) => sum + match.pointsWon, 0);
  return { mine, pointsPlayed: mine.pointsWon + opponentPoints };
}

function share(part: number, whole: number): number {
  return whole === 0 ? 0 : part / whole;
}

/**
 * Up to three numbers worth showing off, from the matches the umpire scored point by point.
 * `mine[i]` and `theirs[i]` are the two sides of the same match. A number appears only when
 * it is good; with no scored matches, or nothing that stands out, the list is empty.
 */
export function standoutFacts(mine: readonly SideStats[], theirs: readonly SideStats[]): StandoutFact[] {
  if (mine.length === 0) return [];
  const { mine: stats, pointsPlayed } = combined(mine, theirs);
  const pointShare = share(stats.pointsWon, pointsPlayed);
  const holdShare = share(stats.serviceGamesHeld, stats.serviceGames);
  const firstServeShare = share(stats.firstServesIn, stats.servicePoints);

  const candidates: (StandoutFact | null)[] = [
    stats.longestPointRun >= MIN_POINT_RUN ? { value: String(stats.longestPointRun), label: "points in a row" } : null,
    stats.breakPointsWon >= MIN_BREAKS ? { value: String(stats.breakPointsWon), label: "breaks of serve" } : null,
    stats.aces >= MIN_ACES ? { value: String(stats.aces), label: "aces" } : null,
    stats.serviceGames >= MIN_SERVICE_GAMES && holdShare >= MIN_HOLD_SHARE
      ? { value: `${stats.serviceGamesHeld}/${stats.serviceGames}`, label: "service games held" }
      : null,
    stats.winners >= MIN_WINNERS ? { value: String(stats.winners), label: "winners" } : null,
    pointsPlayed >= MIN_POINTS_PLAYED && pointShare >= MIN_POINT_SHARE
      ? { value: `${Math.round(pointShare * PERCENT)}%`, label: "of points won" }
      : null,
    stats.servicePoints >= MIN_SERVICE_POINTS && firstServeShare >= MIN_FIRST_SERVE_SHARE
      ? { value: `${Math.round(firstServeShare * PERCENT)}%`, label: "first serves in" }
      : null,
    stats.servicePoints >= MIN_SERVICE_POINTS && stats.doubleFaults === 0 ? { value: "0", label: "double faults" } : null,
  ];
  return candidates.filter((fact): fact is StandoutFact => fact !== null).slice(0, MAX_FACTS);
}
