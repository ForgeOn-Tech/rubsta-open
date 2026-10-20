import type { Category } from "@/db/schema";
import {
  bracketOrder,
  drawSize,
  maxSeeds,
  roundName,
  validateSeedList,
  validateSeeds,
  type BracketSlot,
  type DrawEntrant,
  type SeedValidation,
} from "@/lib/draws";

/**
 * Round-robin groups before a knockout, for the events the organiser plays that way. Each
 * value is how many players the groups send into the knockout: 8 to the quarter-finals,
 * 4 straight to the semi-finals.
 */
export const GROUP_EVENT_QUALIFIERS: Partial<Record<Category, number>> = { OS: 8, S40: 4 };

const FIRST_GROUP_LETTER = "A".charCodeAt(0);
const GROUP_ROUND_NAME = /^Group ([A-Z])$/;

export interface GroupPlan {
  groupCount: number;
  /** 1: only the winner goes through; 2: the winner and the runner-up. */
  qualifiersPerGroup: number;
}

/**
 * How a group event splits its entrants. With more than twice the qualifiers (17–32 in Open
 * singles), every qualifier wins its own group. With up to twice (16), half as many groups
 * each send two. With no more entrants than qualifiers, there are no groups: a plain knockout.
 */
export function groupPlan(category: Category, entrantCount: number): GroupPlan | null {
  const qualifiers = GROUP_EVENT_QUALIFIERS[category];
  if (qualifiers === undefined || entrantCount <= qualifiers) return null;
  if (entrantCount <= qualifiers * 2) return { groupCount: qualifiers / 2, qualifiersPerGroup: 2 };
  return { groupCount: qualifiers, qualifiersPerGroup: 1 };
}

/**
 * Seeds allowed: in a group event, one for each group the entrants could fill (groups of at
 * least 2, at most MAX_GROUPS), since the admin chooses the groups when making the draw.
 * Otherwise the draw's usual limit.
 */
export function seedLimit(category: Category, entrantCount: number): number {
  const plan = groupPlan(category, entrantCount);
  return plan === null ? maxSeeds(drawSize(entrantCount)) : Math.min(MAX_GROUPS, Math.floor(entrantCount / 2));
}

/** Seeds for an event's draw: one per group in a group event, else the draw's usual rule. */
export function validateEventSeeds(category: Category, seeds: readonly (number | null)[]): SeedValidation {
  if (groupPlan(category, seeds.length) === null) return validateSeeds(seeds, drawSize(seeds.length));
  const limit = seedLimit(category, seeds.length);
  return validateSeedList(seeds, limit, `This event takes at most ${limit} seeds, one for each possible group.`);
}

/** The most groups one event can have; 16 groups of 2 already fills a 32-player knockout. */
/** One group has no knockout to feed, so a group event needs two. */
export const MIN_GROUPS = 2;
export const MAX_GROUPS = 16;
export const QUALIFIER_CHOICES = [1, 2] as const;

export type PlanValidation = { ok: true; plan: GroupPlan } | { ok: false; error: string };

function isPowerOfTwo(value: number): boolean {
  return value >= 2 && (value & (value - 1)) === 0;
}

/**
 * The admin's choice of groups for an event, checked: whole numbers, 1 or 2 through from each,
 * a knockout of 2, 4, 8 or 16 places, at least two players in every group, and no more seeds
 * than groups, since each group takes one.
 */
export function validateGroupPlan(input: {
  groupCount: string;
  qualifiersPerGroup: string;
  entrantCount: number;
  seedCount: number;
}): PlanValidation {
  const groupCount = Number(input.groupCount.trim());
  const qualifiersPerGroup = Number(input.qualifiersPerGroup.trim());
  if (!Number.isInteger(groupCount) || groupCount < MIN_GROUPS || groupCount > MAX_GROUPS) {
    return { ok: false, error: `Groups must be a whole number from ${MIN_GROUPS} to ${MAX_GROUPS}.` };
  }
  if (!QUALIFIER_CHOICES.some((choice) => choice === qualifiersPerGroup)) {
    return { ok: false, error: "Choose 1 or 2 to go through from each group." };
  }
  const places = groupCount * qualifiersPerGroup;
  if (!isPowerOfTwo(places)) {
    return {
      ok: false,
      error: `${groupCount} groups with ${qualifiersPerGroup} through make ${places} knockout places; it must be 2, 4, 8 or 16.`,
    };
  }
  if (input.entrantCount < groupCount * 2) {
    return { ok: false, error: `${input.entrantCount} players cannot fill ${groupCount} groups of at least 2.` };
  }
  if (input.seedCount > groupCount) {
    return { ok: false, error: `${groupCount} groups take at most ${groupCount} seeds, one each. Remove the extra seeds first.` };
  }
  return { ok: true, plan: { groupCount, qualifiersPerGroup } };
}

/** The knockout round group qualifiers go into, e.g. "quarter-finals". */
export function knockoutStartName(plan: GroupPlan): string {
  return roundName((plan.groupCount * plan.qualifiersPerGroup) / 2).toLowerCase();
}

/** e.g. "8 groups, winners to the quarter-finals" or "4 groups, top 2 to the quarter-finals". */
export function groupPlanLabel(plan: GroupPlan): string {
  const through = plan.qualifiersPerGroup === 1 ? "winners" : `top ${plan.qualifiersPerGroup}`;
  return `${plan.groupCount} groups, ${through} to the ${knockoutStartName(plan)}`;
}

/** Group 1 is "A". */
export function groupLetter(groupNumber: number): string {
  return String.fromCharCode(FIRST_GROUP_LETTER + groupNumber - 1);
}

/** The round name a group's matches carry, e.g. "Group A". */
export function groupRoundName(groupNumber: number): string {
  return `Group ${groupLetter(groupNumber)}`;
}

/** The group number in a round name such as "Group C", or null for a knockout round. */
export function groupOfRoundName(roundName: string): number | null {
  const match = GROUP_ROUND_NAME.exec(roundName);
  return match === null ? null : match[1].charCodeAt(0) - FIRST_GROUP_LETTER + 1;
}

/** A knockout place a group fills, e.g. "Group A winner" or "Group B runner-up". */
export function groupPlaceLabel(group: number, place: number): string {
  return `${groupRoundName(group)} ${place === 1 ? "winner" : "runner-up"}`;
}

/** One entrant's place in a group. Positions run through every group, group A first. */
export interface GroupLine {
  position: number;
  entryId: string;
  seed: number | null;
  groupNumber: number;
}

function shuffle<Item>(items: readonly Item[], random: () => number): Item[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

/**
 * Puts entrants into groups. Seed k heads group k, so seeds 1 to the group count each get
 * their own group; everyone else is drawn by lot into the groups in turn, so group sizes
 * differ by one at most.
 */
export function generateGroups(entrants: readonly DrawEntrant[], plan: GroupPlan, random: () => number): GroupLine[] {
  if (entrants.some((entrant) => entrant.seed !== null && entrant.seed > plan.groupCount)) {
    throw new Error(`A draw of ${plan.groupCount} groups has at most ${plan.groupCount} seeds.`);
  }
  const seeded = entrants.filter((entrant) => entrant.seed !== null);
  const others = shuffle(
    entrants.filter((entrant) => !seeded.includes(entrant)),
    random,
  );
  const groups: DrawEntrant[][] = Array.from({ length: plan.groupCount }, () => []);
  for (const entrant of seeded) groups[(entrant.seed as number) - 1].push(entrant);
  for (const entrant of others) {
    const smallest = groups.reduce((best, group, index) => (group.length < groups[best].length ? index : best), 0);
    groups[smallest].push(entrant);
  }
  let position = 0;
  return groups.flatMap((members, index) =>
    members.map((entrant) => {
      position += 1;
      return {
        position,
        entryId: entrant.entryId,
        seed: entrant.seed,
        groupNumber: index + 1,
      };
    }),
  );
}

/**
 * Every pairing in a group, round by round, by the circle method: in each round nobody
 * plays twice, so a group's matches can go on court in this order.
 */
export function roundRobinPairs<Member>(members: readonly Member[]): [Member, Member][] {
  if (members.length < 2) return [];
  // An odd group gets a rest each round, written as null.
  const ring: (Member | null)[] = members.length % 2 === 0 ? [...members] : [...members, null];
  const pairs: [Member, Member][] = [];
  for (let round = 0; round < ring.length - 1; round++) {
    for (let index = 0; index < ring.length / 2; index++) {
      const top = ring[index];
      const bottom = ring[ring.length - 1 - index];
      if (top !== null && bottom !== null) pairs.push([top, bottom]);
    }
    // Keep the first member fixed and turn the rest one place.
    ring.splice(1, 0, ring.pop() as Member | null);
  }
  return pairs;
}

/**
 * The knockout's first-round places, top to bottom. Group k's winner takes seed k's line.
 * With two through, each runner-up faces the winner of the neighbouring group (A against B,
 * C against D), so they sit in the other half from their own group's winner and can meet
 * them only in the final.
 */
export function knockoutSlots(plan: GroupPlan): BracketSlot[] {
  const size = plan.groupCount * plan.qualifiersPerGroup;
  const order = bracketOrder(size);
  const lineOfSeed = (seed: number): number => order.indexOf(seed);
  const slots: BracketSlot[] = Array.from({ length: size }, () => ({ kind: "bye" }));
  for (let group = 1; group <= plan.groupCount; group++) {
    slots[lineOfSeed(group)] = { kind: "group", group, place: 1 };
  }
  if (plan.qualifiersPerGroup === 2) {
    for (let group = 1; group <= plan.groupCount; group++) {
      const neighbour = group % 2 === 1 ? group + 1 : group - 1;
      const winnerLine = lineOfSeed(neighbour);
      // Lines pair up 0–1, 2–3: the runner-up takes the line facing the neighbour's winner.
      slots[winnerLine % 2 === 0 ? winnerLine + 1 : winnerLine - 1] = { kind: "group", group, place: 2 };
    }
  }
  if (slots.some((slot) => slot.kind === "bye")) {
    throw new Error(`A knockout of ${plan.groupCount} groups with ${plan.qualifiersPerGroup} through has an empty line.`);
  }
  return slots;
}

/** One finished or unfinished group match, as the standings need it. */
export interface GroupResult {
  top: string;
  bottom: string;
  /** Null while the match is unfinished. */
  winner: string | null;
  /** Games each side won; a walkover counts none. */
  games: { top: number; bottom: number };
}

export interface StandingRow {
  entryId: string;
  played: number;
  won: number;
  lost: number;
  gamesWon: number;
  gamesLost: number;
  /** 1 for first. Players the rules cannot separate share a place. */
  place: number;
}

export interface GroupStandings {
  rows: StandingRow[];
  /** Every match in the group is finished. */
  complete: boolean;
}

interface Tally {
  entryId: string;
  played: number;
  won: number;
  lost: number;
  gamesWon: number;
  gamesLost: number;
}

function tallies(members: readonly string[], results: readonly GroupResult[]): Map<string, Tally> {
  const table = new Map(members.map((entryId) => [entryId, { entryId, played: 0, won: 0, lost: 0, gamesWon: 0, gamesLost: 0 }]));
  for (const result of results) {
    if (result.winner === null) continue;
    const top = table.get(result.top);
    const bottom = table.get(result.bottom);
    if (!top || !bottom) throw new Error(`A group result names ${result.top} or ${result.bottom}, who are not in the group.`);
    top.played += 1;
    bottom.played += 1;
    top.gamesWon += result.games.top;
    top.gamesLost += result.games.bottom;
    bottom.gamesWon += result.games.bottom;
    bottom.gamesLost += result.games.top;
    if (result.winner === result.top) {
      top.won += 1;
      bottom.lost += 1;
    } else {
      bottom.won += 1;
      top.lost += 1;
    }
  }
  return table;
}

/** Groups items by a number, highest first. */
function splitBy<Item>(items: readonly Item[], value: (item: Item) => number): Item[][] {
  const values = [...new Set(items.map(value))].sort((a, b) => b - a);
  return values.map((each) => items.filter((item) => value(item) === each));
}

/** Wins among `tied` only, from the finished matches between them. */
function headToHeadWins(tied: readonly Tally[], results: readonly GroupResult[]): Map<string, number> {
  const ids = new Set(tied.map((tally) => tally.entryId));
  const wins = new Map(tied.map((tally) => [tally.entryId, 0]));
  for (const result of results) {
    if (result.winner !== null && ids.has(result.top) && ids.has(result.bottom)) {
      wins.set(result.winner, (wins.get(result.winner) ?? 0) + 1);
    }
  }
  return wins;
}

/**
 * Orders players level on wins: head to head among them, then games won. Whenever either
 * splits them, the rules start again for each smaller group still level. Players the rules
 * cannot split come back together.
 */
function separate(tied: readonly Tally[], results: readonly GroupResult[]): Tally[][] {
  if (tied.length === 1) return [[...tied]];
  const wins = headToHeadWins(tied, results);
  const byHeadToHead = splitBy(tied, (tally) => wins.get(tally.entryId) ?? 0);
  if (byHeadToHead.length > 1) return byHeadToHead.flatMap((group) => separate(group, results));
  const byGames = splitBy(tied, (tally) => tally.gamesWon);
  if (byGames.length > 1) return byGames.flatMap((group) => separate(group, results));
  return [[...tied]];
}

/**
 * A group's table, by the organiser's order: matches won, then head to head, then games won.
 * Only finished matches count.
 */
export function groupStandings(members: readonly string[], results: readonly GroupResult[]): GroupStandings {
  const table = tallies(members, results);
  const ordered = splitBy([...table.values()], (tally) => tally.won).flatMap((level) => separate(level, results));
  let place = 1;
  const rows = ordered.flatMap((level) => {
    const rowsAtPlace = [...level]
      .sort((a, b) => a.entryId.localeCompare(b.entryId))
      .map((tally) => ({ ...tally, place }));
    place += level.length;
    return rowsAtPlace;
  });
  const expected = (members.length * (members.length - 1)) / 2;
  return { rows, complete: results.filter((result) => result.winner !== null).length === expected };
}

/** True once any match in the group has a result, so places mean something. */
export function hasStarted(standings: GroupStandings): boolean {
  return standings.rows.some((row) => row.played > 0);
}

/**
 * Who goes through, by place, once the group is finished: null for a place the rules leave
 * level, which an admin then decides. Null for every place while matches remain.
 */
export function groupQualifiers(standings: GroupStandings, qualifiersPerGroup: number): (string | null)[] {
  return Array.from({ length: qualifiersPerGroup }, (_unused, index) => {
    if (!standings.complete) return null;
    const atPlace = standings.rows.filter((row) => row.place === index + 1);
    return atPlace.length === 1 ? atPlace[0].entryId : null;
  });
}
