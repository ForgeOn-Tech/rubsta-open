import { formatSummary } from "./match-formats";
import { applyEvent, initialState, other, type CompletedSet, type MatchEvent, type MatchFormat, type MatchState, type Side } from "./match";

/**
 * One set of a score written on paper. For a set that went to a tiebreak, `tiebreak`
 * holds both sides' tiebreak points; for a deciding match tiebreak, `top` and `bottom`
 * are its points, e.g. 10 and 8.
 */
export interface PaperSet {
  top: number;
  bottom: number;
  tiebreak: Record<Side, number> | null;
}

export type FinalScoreCheck = { ok: true; events: MatchEvent[] } | { ok: false; error: string };

/** The paper score names one side in every game, so the first server makes no difference. */
export const PAPER_FIRST_SERVER: Side = "top";
const POINTS_PER_LOVE_GAME = 4;

function points(side: Side, count: number): MatchEvent[] {
  return Array.from({ length: count }, () => ({ type: "point", side }) as const);
}

/**
 * `winnerCount` units for the winner and `loserCount` for the loser, alternating so the
 * winner is never more than one ahead until the loser runs out, with the winner's last unit
 * last. Nobody can win a game, set or tiebreak early that way.
 */
function interleave(winner: Side, winnerCount: number, loserCount: number): Side[] {
  const order: Side[] = [];
  let won = 0;
  let lost = 0;
  while (won < winnerCount - 1 || lost < loserCount) {
    const winnerTurn = lost >= loserCount || (won <= lost && won < winnerCount - 1);
    order.push(winnerTurn ? winner : other(winner));
    if (winnerTurn) won += 1;
    else lost += 1;
  }
  return [...order, winner];
}

function setEvents(set: PaperSet, format: MatchFormat, matchTiebreak: boolean): MatchEvent[] {
  const winner: Side = set.top > set.bottom ? "top" : "bottom";
  const loser = other(winner);
  if (matchTiebreak) return interleave(winner, set[winner], set[loser]).flatMap((side) => points(side, 1));
  if (set.tiebreak === null) {
    return interleave(winner, set[winner], set[loser]).flatMap((side) => points(side, POINTS_PER_LOVE_GAME));
  }
  // Games to the tiebreak score, then the tiebreak points.
  const toTiebreak = interleave(winner, format.tiebreakAt + 1, format.tiebreakAt).slice(0, -1);
  return [
    ...toTiebreak.flatMap((side) => points(side, POINTS_PER_LOVE_GAME)),
    ...interleave(winner, set.tiebreak[winner], set.tiebreak[loser]).flatMap((side) => points(side, 1)),
  ];
}

function setText(set: PaperSet, matchTiebreak: boolean): string {
  if (matchTiebreak) return `[${set.top}–${set.bottom}]`;
  const tiebreak = set.tiebreak === null ? "" : `(${Math.min(set.tiebreak.top, set.tiebreak.bottom)})`;
  return `${set.top}–${set.bottom}${tiebreak}`;
}

/** "6–4 3–6 [10–8]", top side first. */
export function paperScoreText(sets: readonly PaperSet[], format: MatchFormat): string {
  return sets
    .map((set, index) => setText(set, isMatchTiebreak(format, index)))
    .join(" ");
}

/**
 * Turns a final score from paper into point events, so standings, the draw and the score
 * line work as for a match scored point by point. The events are checked by replaying them
 * under `format`: they must finish the match with exactly the sets written down.
 */
export function finalScoreEvents(sets: readonly PaperSet[], format: MatchFormat): FinalScoreCheck {
  if (sets.length === 0) return { ok: false, error: "Enter the games for at least one set." };
  if (sets.some((set) => set.top === set.bottom)) {
    return { ok: false, error: "Each set needs a winner: the two scores cannot be equal." };
  }
  const events = sets.flatMap((set, index) => setEvents(set, format, isMatchTiebreak(format, index)));
  const state = replay(events, format);
  const same =
    state !== null &&
    state.status === "completed" &&
    state.sets.length === sets.length &&
    sets.every((set, index) => sameSet(set, state.sets[index]));
  if (!same) {
    return {
      ok: false,
      error: `${paperScoreText(sets, format)} does not finish a match played as: ${formatSummary(format)}. Check each set's games and any tiebreak points.`,
    };
  }
  return { ok: true, events };
}

/** The state after `events`, or null when the match ends before they run out, e.g. 8–2 in a set to 6. */
function replay(events: readonly MatchEvent[], format: MatchFormat): MatchState | null {
  let state = initialState(PAPER_FIRST_SERVER, format);
  for (const event of events) {
    if (state.status === "completed") return null;
    state = applyEvent(state, event, format);
  }
  return state;
}

function isMatchTiebreak(format: MatchFormat, index: number): boolean {
  return format.decidingSet === "matchTiebreak" && index === format.setsToWin * 2 - 2;
}

/** Whether a replayed set is the one written down. A match tiebreak is written as its points. */
function sameSet(written: PaperSet, played: CompletedSet): boolean {
  if (played.matchTiebreak) {
    return played.tiebreak !== null && played.tiebreak.top === written.top && played.tiebreak.bottom === written.bottom;
  }
  const sameGames = played.games.top === written.top && played.games.bottom === written.bottom;
  if (written.tiebreak === null) return sameGames && played.tiebreak === null;
  return (
    sameGames &&
    played.tiebreak !== null &&
    played.tiebreak.top === written.tiebreak.top &&
    played.tiebreak.bottom === written.tiebreak.bottom
  );
}

/** True when a set at these games was decided by a tiebreak under `format`. */
export function needsTiebreak(top: number, bottom: number, format: MatchFormat): boolean {
  return Math.max(top, bottom) === format.tiebreakAt + 1 && Math.min(top, bottom) === format.tiebreakAt;
}
