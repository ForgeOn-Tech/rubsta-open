import type { EntryStatus } from "@/db/schema";

export const MIN_DRAW_ENTRANTS = 2;
export const MAX_DRAW_SIZE = 128;
const MIN_SEEDS_WHEN_SEEDED = 2;
const LINES_PER_SEED = 4;

/** Entries that go into a draw. */
export const DRAW_ELIGIBLE_STATUSES: readonly EntryStatus[] = ["confirmed", "paid"];

export function isDrawEligible(status: EntryStatus): boolean {
  return DRAW_ELIGIBLE_STATUSES.includes(status);
}

export interface DrawEntrant {
  entryId: string;
  seed: number | null;
}

/** One first-round line. A null entry is a bye. */
export interface DrawLine {
  position: number;
  entryId: string | null;
  seed: number | null;
}

function range(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

function isPowerOfTwo(value: number): boolean {
  return Number.isInteger(value) && value > 0 && (value & (value - 1)) === 0;
}

function assertDrawSize(size: number): void {
  if (!isPowerOfTwo(size) || size < MIN_DRAW_ENTRANTS || size > MAX_DRAW_SIZE) {
    throw new Error(
      `Draw size must be a power of two from ${MIN_DRAW_ENTRANTS} to ${MAX_DRAW_SIZE}; got ${size}.`,
    );
  }
}

/** Fisher–Yates on a copy. `random` returns a number in [0, 1). */
function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

/** Smallest power of two that holds every entrant. */
export function drawSize(entrantCount: number): number {
  if (!Number.isInteger(entrantCount) || entrantCount < MIN_DRAW_ENTRANTS) {
    throw new Error(
      `A draw needs at least ${MIN_DRAW_ENTRANTS} entrants; got ${entrantCount}.`,
    );
  }
  let size = MIN_DRAW_ENTRANTS;
  while (size < entrantCount) size *= 2;
  if (size > MAX_DRAW_SIZE) {
    throw new Error(`${entrantCount} entrants exceed the ${MAX_DRAW_SIZE}-line draw limit.`);
  }
  return size;
}

/** Seeds allowed: none in a draw of 2, then one per four lines with at least 2 (8 → 2, 32 → 8). */
export function maxSeeds(size: number): number {
  assertDrawSize(size);
  if (size === MIN_DRAW_ENTRANTS) return 0;
  return Math.max(MIN_SEEDS_WHEN_SEEDED, size / LINES_PER_SEED);
}

/**
 * Seeding value for each line, top to bottom. 8 → [1, 8, 5, 4, 3, 6, 7, 2].
 * In a 32 draw, values 1–4 sit on lines 1, 32, 17 and 16, as in the organiser artboard.
 */
export function bracketOrder(size: number): number[] {
  assertDrawSize(size);
  let order = [1, 2];
  while (order.length < size) {
    const pairTotal = order.length * 2 + 1;
    order = order.flatMap((value, index) =>
      index % 2 === 0 ? [value, pairTotal - value] : [pairTotal - value, value],
    );
  }
  return order;
}

/** Seeds that share lines by lot: 1, 2, 3–4, 5–8, 9–16, … */
function seedGroup(seed: number): { first: number; last: number } {
  if (seed <= 2) return { first: seed, last: seed };
  let last = 4;
  while (last < seed) last *= 2;
  return { first: last / 2 + 1, last };
}

function opponentLine(line: number): number {
  return line % 2 === 1 ? line + 1 : line - 1;
}

export type SeedValidation = { ok: true } | { ok: false; error: string };

/** Seeds must be whole numbers 1..k with no gaps or repeats, and k within the draw's limit. */
export function validateSeeds(seeds: readonly (number | null)[], size: number): SeedValidation {
  const given = seeds.filter((seed): seed is number => seed !== null);
  const limit = maxSeeds(size);
  if (given.some((seed) => !Number.isInteger(seed) || seed < 1)) {
    return { ok: false, error: "Seeds must be whole numbers from 1." };
  }
  if (given.length > limit) {
    return {
      ok: false,
      error:
        limit === 0
          ? `A ${size}-line draw has no seeds.`
          : `A ${size}-line draw has at most ${limit} seeds.`,
    };
  }
  if (new Set(given).size !== given.length) {
    return { ok: false, error: "Each seed number can be used once." };
  }
  const missing = range(1, given.length).find((seed) => !given.includes(seed));
  if (missing !== undefined) {
    return {
      ok: false,
      error: `Seeds must run from 1 to ${given.length} without gaps; seed ${missing} is missing.`,
    };
  }
  return { ok: true };
}

/**
 * Places entrants on first-round lines.
 * - Seeds 1 and 2 take the top and bottom lines; each later group (3–4, 5–8, …)
 *   draws lots for its group's lines.
 * - Byes go opposite seeds in seed order, then opposite the next unseeded lines
 *   in bracket order, so a bye never meets another bye.
 * - Unseeded entrants fill the remaining lines by lot.
 */
export function generateDraw(entrants: readonly DrawEntrant[], random: () => number): DrawLine[] {
  const size = drawSize(entrants.length);
  const seedCheck = validateSeeds(
    entrants.map((entrant) => entrant.seed),
    size,
  );
  if (!seedCheck.ok) throw new Error(seedCheck.error);
  if (new Set(entrants.map((entrant) => entrant.entryId)).size !== entrants.length) {
    throw new Error("Each entry can appear in a draw once.");
  }

  const order = bracketOrder(size);
  const lineOfValue = (value: number): number => order.indexOf(value) + 1;
  const assigned = new Map<number, DrawLine>();

  const seeded = entrants
    .filter((entrant): entrant is { entryId: string; seed: number } => entrant.seed !== null)
    .sort((a, b) => a.seed - b.seed);

  const groups = new Map<number, typeof seeded>();
  for (const entrant of seeded) {
    const { first } = seedGroup(entrant.seed);
    groups.set(first, [...(groups.get(first) ?? []), entrant]);
  }
  for (const [first, members] of groups) {
    const { last } = seedGroup(first);
    const lines = shuffle(range(first, last).map(lineOfValue), random);
    members.forEach((entrant, index) => {
      assigned.set(lines[index], {
        position: lines[index],
        entryId: entrant.entryId,
        seed: entrant.seed,
      });
    });
  }

  const byeCount = size - entrants.length;
  const seedLines = seeded.map(
    (entrant) => [...assigned.values()].find((line) => line.entryId === entrant.entryId)!.position,
  );
  const byeLines = seedLines.slice(0, byeCount).map(opponentLine);
  for (let value = 1; byeLines.length < byeCount; value += 1) {
    const line = lineOfValue(value);
    if (!assigned.has(line)) byeLines.push(opponentLine(line));
  }
  for (const line of byeLines) {
    assigned.set(line, { position: line, entryId: null, seed: null });
  }

  const openLines = range(1, size).filter((line) => !assigned.has(line));
  const unseeded = shuffle(
    entrants.filter((entrant) => entrant.seed === null),
    random,
  );
  unseeded.forEach((entrant, index) => {
    assigned.set(openLines[index], {
      position: openLines[index],
      entryId: entrant.entryId,
      seed: null,
    });
  });

  return [...assigned.values()].sort((a, b) => a.position - b.position);
}

export type BracketSlot =
  | { kind: "entry"; entryId: string; seed: number | null }
  | { kind: "bye" }
  | { kind: "winner"; matchNumber: number };

export interface BracketMatch {
  number: number;
  top: BracketSlot;
  bottom: BracketSlot;
}

export interface BracketRound {
  name: string;
  matches: BracketMatch[];
}

export function roundName(matchCount: number): string {
  if (matchCount === 1) return "Final";
  if (matchCount === 2) return "Semi-finals";
  if (matchCount === 4) return "Quarter-finals";
  return `Round of ${matchCount * 2}`;
}

function advance(match: BracketMatch): BracketSlot {
  if (match.top.kind === "bye" && match.bottom.kind === "entry") return match.bottom;
  if (match.bottom.kind === "bye" && match.top.kind === "entry") return match.top;
  return { kind: "winner", matchNumber: match.number };
}

function pairs<T>(items: readonly T[]): [T, T][] {
  return range(0, items.length / 2 - 1).map((index) => [items[index * 2], items[index * 2 + 1]]);
}

/**
 * Every round of a draw, with matches numbered top to bottom, round by round.
 * A player facing a first-round bye appears in the next round directly.
 */
export function buildBracket(lines: readonly DrawLine[]): BracketRound[] {
  assertDrawSize(lines.length);
  const sorted = [...lines].sort((a, b) => a.position - b.position);
  if (sorted.some((line, index) => line.position !== index + 1)) {
    throw new Error("Draw lines must cover positions 1 to the draw size once each.");
  }

  let matchNumber = 0;
  const slotFor = (line: DrawLine): BracketSlot =>
    line.entryId === null
      ? { kind: "bye" }
      : { kind: "entry", entryId: line.entryId, seed: line.seed };

  let current: BracketMatch[] = pairs(sorted).map(([top, bottom]) => {
    matchNumber += 1;
    return { number: matchNumber, top: slotFor(top), bottom: slotFor(bottom) };
  });
  const rounds: BracketRound[] = [{ name: roundName(current.length), matches: current }];

  while (current.length > 1) {
    current = pairs(current).map(([top, bottom]) => {
      matchNumber += 1;
      return { number: matchNumber, top: advance(top), bottom: advance(bottom) };
    });
    rounds.push({ name: roundName(current.length), matches: current });
  }
  return rounds;
}

export interface DrawChanges {
  /** Eligible entries missing from the draw. */
  added: string[];
  /** Drawn entries that are no longer eligible. */
  removed: string[];
  /** Drawn entries whose seed changed since the draw was made. */
  reseeded: string[];
}

/** What changed between a generated draw and the entries and seeds as they are now. */
export function drawChanges(
  drawn: readonly { entryId: string | null; seed: number | null }[],
  eligible: readonly DrawEntrant[],
): DrawChanges {
  const drawnEntries = drawn.filter(
    (line): line is { entryId: string; seed: number | null } => line.entryId !== null,
  );
  const drawnIds = new Set(drawnEntries.map((line) => line.entryId));
  const eligibleById = new Map(eligible.map((entrant) => [entrant.entryId, entrant]));
  return {
    added: eligible.map((entrant) => entrant.entryId).filter((id) => !drawnIds.has(id)),
    removed: drawnEntries.map((line) => line.entryId).filter((id) => !eligibleById.has(id)),
    reseeded: drawnEntries
      .filter((line) => {
        const current = eligibleById.get(line.entryId);
        return current !== undefined && current.seed !== line.seed;
      })
      .map((line) => line.entryId),
  };
}

export function hasDrawChanges(changes: DrawChanges): boolean {
  return changes.added.length + changes.removed.length + changes.reseeded.length > 0;
}
