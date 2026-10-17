import {
  advantageSide,
  applyEvent,
  changeEndsAfterThisGame,
  deriveState,
  isDecidingPoint,
  isDeuce,
  other,
  type MatchEvent,
  type MatchFormat,
  type MatchState,
  type PointFinish,
  type Side,
} from "@/lib/match";

const GAME_CALLS = ["0", "15", "30", "40"] as const;

/** What the umpire would say: the big call, and a line under it when there is more to say. */
export interface UmpireCall {
  call: string;
  detail: string | null;
}

/**
 * The score as an umpire calls it, server first: "30–15", "Deuce", "Advantage Arjun Mehta",
 * "Deciding point", or in a tiebreak "Tiebreak 3–2".
 */
export function umpireCall(state: MatchState, names: Record<Side, string>, format: MatchFormat): UmpireCall {
  const server = state.server;
  const receiver = other(server);
  if (state.tiebreak) {
    return {
      call: `${state.points[server]}–${state.points[receiver]}`,
      detail: state.tiebreakTarget === null ? "Tiebreak" : `Tiebreak to ${state.tiebreakTarget}`,
    };
  }
  if (isDecidingPoint(state, format)) return { call: "Deciding point", detail: "Receiver chooses the side" };
  if (isDeuce(state)) return { call: "Deuce", detail: null };
  const ahead = advantageSide(state);
  if (ahead !== null) return { call: "Advantage", detail: names[ahead] };
  return { call: `${GAME_CALLS[state.points[server]]}–${GAME_CALLS[state.points[receiver]]}`, detail: null };
}

const FINISH_WORDS: Record<PointFinish, string> = { ace: "Ace", winner: "Winner", opponentError: "Mistake" };

/**
 * One line on what the last event did, for the umpire to check at a glance: "Point Arjun
 * Mehta · Winner", "Fault · 2nd serve", "Game Arjun Mehta · 3–2 · Change ends". Null before
 * any event.
 */
export function lastEventMessage(
  events: readonly MatchEvent[],
  format: MatchFormat,
  firstServer: Side,
  names: Record<Side, string>,
): string | null {
  const last = events.at(-1);
  if (last === undefined) return null;
  const before = deriveState(events.slice(0, -1), format, firstServer);
  // Read these first: applying an event appends a finished set to the list both states share.
  const setsBefore = before.sets.length;
  const gamesBefore = before.games.top + before.games.bottom;
  const endsAfterGame = changeEndsAfterThisGame(before);
  const after = applyEvent(before, last, format);
  if (last.type === "fault") return "Fault · 2nd serve";
  if (last.type === "let") return "Let · replay the serve";

  const winner: Side = last.type === "point" ? last.side : other(before.server);
  const point =
    last.type === "doubleFault"
      ? `Double fault · point ${names[winner]}`
      : `Point ${names[winner]}${last.finish === undefined ? "" : ` · ${FINISH_WORDS[last.finish]}`}`;
  if (after.sets.length > setsBefore) {
    const set = after.sets[after.sets.length - 1];
    return `${point} · Set ${names[winner]} ${set.games[winner]}–${set.games[other(winner)]}`;
  }
  // The set did not end, so a change in the games total means a game did.
  if (after.games.top + after.games.bottom !== gamesBefore) {
    const ends = endsAfterGame ? " · Change ends" : "";
    return `Game ${names[winner]} · ${after.games.top}–${after.games.bottom}${ends}`;
  }
  return point;
}

export interface ReasonChoice {
  finish: PointFinish;
  label: string;
}

/**
 * How the last point could have been won, for the umpire to record after scoring it: an ace
 * only when its winner served, a winner, or a mistake by the other side. Empty when the last
 * event is not a point, already has a reason, or there is none.
 */
export function reasonChoices(
  events: readonly MatchEvent[],
  format: MatchFormat,
  firstServer: Side,
  names: Record<Side, string>,
): ReasonChoice[] {
  const last = events.at(-1);
  if (last === undefined || last.type !== "point" || last.finish !== undefined) return [];
  const before = deriveState(events.slice(0, -1), format, firstServer);
  return pointReasons(last.side, before.server, names);
}

/** The reasons a point won by `side` can have, when `server` served it. */
export function pointReasons(side: Side, server: Side, names: Record<Side, string>): ReasonChoice[] {
  return [
    ...(side === server ? [{ finish: "ace" as const, label: `Ace by ${names[side]}` }] : []),
    { finish: "winner", label: `Winner by ${names[side]}` },
    { finish: "opponentError", label: `Mistake by ${names[other(side)]}` },
  ];
}
