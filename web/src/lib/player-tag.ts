import { CATEGORY_LABELS, type Category } from "@/db/schema";

/** How far the player got in one event, as eventResultLabel writes it. */
export interface EventStanding {
  category: Category;
  label: string;
}

/** One set of a match the player played, from their side. */
export interface PlayedSet {
  mine: number;
  theirs: number;
  /** The set went to a tiebreak (a deciding match tiebreak counts). */
  tiebreak: boolean;
}

/** A finished match the player played points in. Walkovers are left out. */
export interface PlayedMatch {
  won: boolean;
  sets: readonly PlayedSet[];
}

export type TagKind =
  | "champion"
  | "finalist"
  | "intoFinal"
  | "semiFinalist"
  | "intoSemis"
  | "quarterFinalist"
  | "knockouts"
  | "unbeaten"
  | "bagel"
  | "tiebreak"
  | "comeback"
  | "winner"
  | "fighter"
  | "ready";

export interface PlayerTag {
  kind: TagKind;
  /** The big words on the card, e.g. "Champion". */
  title: string;
  /** One line under it, e.g. "Top of the 40+ singles draw." */
  line: string;
}

/** Every tag's words, kept together so organisers can reword them in one place. */
export const TAG_WORDS: Record<TagKind, { title: string; line: (detail: string) => string }> = {
  champion: { title: "Champion", line: (event) => `Top of the ${event} draw. Take a bow.` },
  finalist: { title: "Finalist", line: (event) => `Made the ${event} final. What a run.` },
  intoFinal: { title: "Into the final", line: (event) => `One match from the ${event} title.` },
  semiFinalist: { title: "Semi-finalist", line: (event) => `Last four in ${event}.` },
  intoSemis: { title: "Into the semis", line: (event) => `Through to the ${event} semi-finals.` },
  quarterFinalist: { title: "Quarter-finalist", line: (event) => `Last eight in ${event}.` },
  knockouts: { title: "Into the knockouts", line: (event) => `Out of the group and into the ${event} knockouts.` },
  unbeaten: { title: "Unbeaten", line: (played) => `${played} matches played, ${played} won.` },
  bagel: { title: "Bagel baker", line: () => "Won a set 6–0." },
  tiebreak: { title: "Tiebreak hero", line: () => "Held their nerve to win a tiebreak." },
  comeback: { title: "Comeback kid", line: () => "Lost the first set, won the match." },
  winner: { title: "Match winner", line: (won) => (won === "1" ? "Won a match at the Rubsta Open." : `Won ${won} matches at the Rubsta Open.`) },
  fighter: { title: "Brought the fight", line: () => "Stepped on court and gave it everything." },
  ready: { title: "Game on", line: () => "Ready for the Rubsta Open." },
};

/** Knockout standings from best to least, with the tag each one earns. */
const STANDING_TAGS: { matches: (label: string) => boolean; kind: TagKind }[] = [
  { matches: (label) => label === "Winner", kind: "champion" },
  { matches: (label) => label === "Runner-up", kind: "finalist" },
  { matches: (label) => label === "Advanced from Semi-finals", kind: "intoFinal" },
  { matches: (label) => label === "Reached Semi-finals", kind: "semiFinalist" },
  { matches: (label) => label === "Advanced from Quarter-finals", kind: "intoSemis" },
  { matches: (label) => label === "Reached Quarter-finals", kind: "quarterFinalist" },
  { matches: (label) => label.startsWith("Through from") || label.startsWith("Advanced from") || label.startsWith("Reached"), kind: "knockouts" },
];

const MIN_UNBEATEN_MATCHES = 2;
const BAGEL_GAMES = 6;

function tag(kind: TagKind, detail: string): PlayerTag {
  return { kind, title: TAG_WORDS[kind].title, line: TAG_WORDS[kind].line(detail) };
}

function eventName(category: Category): string {
  return CATEGORY_LABELS[category];
}

/**
 * The one tag a player's card shows, always something true and something to be proud of.
 * A run in a draw counts first, then how they won, then that they played at all. A player
 * who only had walkovers, or no matches yet, gets a welcome instead of a result.
 */
export function playerTag(standings: readonly EventStanding[], played: readonly PlayedMatch[]): PlayerTag {
  for (const { matches, kind } of STANDING_TAGS) {
    const standing = standings.find((event) => matches(event.label));
    if (standing !== undefined) return tag(kind, eventName(standing.category));
  }

  const wins = played.filter((match) => match.won);
  if (played.length >= MIN_UNBEATEN_MATCHES && wins.length === played.length) return tag("unbeaten", String(played.length));
  if (wins.some((match) => match.sets.some((set) => set.mine === BAGEL_GAMES && set.theirs === 0))) return tag("bagel", "");
  if (wins.some((match) => match.sets.some((set) => set.tiebreak && set.mine > set.theirs))) return tag("tiebreak", "");
  if (wins.some((match) => match.sets.length > 1 && match.sets[0].mine < match.sets[0].theirs)) return tag("comeback", "");
  if (wins.length > 0) return tag("winner", String(wins.length));
  if (played.length > 0) return tag("fighter", "");
  return tag("ready", "");
}
