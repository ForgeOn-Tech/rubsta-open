import { describe, expect, it } from "vitest";

import type { EntryStatus } from "@/db/schema";
import {
  bracketOrder,
  buildBracket,
  canDraw,
  describeDrawChanges,
  eligibleRows,
  parseSeedInput,
  toDrawEntrant,
  drawChanges,
  drawSize,
  generateDraw,
  hasDrawChanges,
  maxSeeds,
  roundName,
  validateSeeds,
  type DrawEntrant,
  type DrawLine,
} from "@/lib/draws";

/** Small seeded PRNG so every run places the same draws. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function entrants(count: number, seedCount: number): DrawEntrant[] {
  return Array.from({ length: count }, (_, index) => ({
    entryId: `entry-${index + 1}`,
    seed: index < seedCount ? index + 1 : null,
  }));
}

function lineOfSeed(lines: readonly DrawLine[], seed: number): number {
  const line = lines.find((item) => item.seed === seed);
  if (!line) throw new Error(`Seed ${seed} is not in the draw.`);
  return line.position;
}

function opponent(position: number): number {
  return position % 2 === 1 ? position + 1 : position - 1;
}

const half = (position: number, size: number) => (position <= size / 2 ? 0 : 1);

/** Every rule a generated draw must keep, whatever the lots. */
function expectValidDraw(lines: DrawLine[], field: DrawEntrant[]): void {
  const size = drawSize(field.length);
  const byes = size - field.length;
  const seedCount = field.filter((entrant) => entrant.seed !== null).length;
  const byPosition = new Map(lines.map((line) => [line.position, line]));

  expect(lines.map((line) => line.position)).toEqual(
    Array.from({ length: size }, (_, index) => index + 1),
  );
  const placed = lines.flatMap((line) => (line.entryId ? [line.entryId] : []));
  expect([...placed].sort()).toEqual(field.map((entrant) => entrant.entryId).sort());
  expect(lines.filter((line) => line.entryId === null)).toHaveLength(byes);

  for (const line of lines) {
    if (line.entryId === null) {
      expect(byPosition.get(opponent(line.position))?.entryId, `bye at ${line.position}`).not.toBeNull();
    }
  }

  if (seedCount >= 1) expect(lineOfSeed(lines, 1)).toBe(1);
  if (seedCount >= 2) expect(lineOfSeed(lines, 2)).toBe(size);
  if (seedCount >= 4) {
    expect(half(lineOfSeed(lines, 3), size)).not.toBe(half(lineOfSeed(lines, 4), size));
  }

  const order = bracketOrder(size);
  for (let seed = 3; seed <= seedCount; seed += 1) {
    const value = order[lineOfSeed(lines, seed) - 1];
    let groupLast = 4;
    while (groupLast < seed) groupLast *= 2;
    expect(value, `seed ${seed} line value`).toBeGreaterThan(groupLast / 2);
    expect(value, `seed ${seed} line value`).toBeLessThanOrEqual(groupLast);
  }

  for (let seed = 1; seed <= seedCount; seed += 1) {
    const facesBye = byPosition.get(opponent(lineOfSeed(lines, seed)))?.entryId === null;
    expect(facesBye, `seed ${seed} bye`).toBe(seed <= byes);
  }
}

describe("drawSize", () => {
  it("rounds up to a power of two", () => {
    expect(drawSize(2)).toBe(2);
    expect(drawSize(5)).toBe(8);
    expect(drawSize(16)).toBe(16);
    expect(drawSize(17)).toBe(32);
  });

  it("throws below two entrants and above the size limit", () => {
    expect(() => drawSize(1)).toThrow("A draw needs at least 2 entrants; got 1.");
    expect(() => drawSize(129)).toThrow("129 entrants exceed the 128-line draw limit.");
  });
});

describe("maxSeeds", () => {
  it("allows one seed per four lines, at least two, and none in a draw of two", () => {
    expect([2, 4, 8, 16, 32, 64].map(maxSeeds)).toEqual([0, 2, 2, 4, 8, 16]);
  });
});

describe("bracketOrder", () => {
  it("keeps each first-round pair summing to size + 1", () => {
    for (const size of [2, 4, 8, 16, 32, 64]) {
      const order = bracketOrder(size);
      for (let index = 0; index < size; index += 2) {
        expect(order[index] + order[index + 1]).toBe(size + 1);
      }
    }
  });

  it("puts seeds 1–4 of a 32 draw on lines 1, 16, 17 and 32, as in the artboard", () => {
    const order = bracketOrder(32);
    const lines = [1, 2, 3, 4].map((value) => order.indexOf(value) + 1).sort((a, b) => a - b);
    expect(lines).toEqual([1, 16, 17, 32]);
  });
});

describe("validateSeeds", () => {
  it("accepts no seeds or a full run from 1", () => {
    expect(validateSeeds([null, null], 8)).toEqual({ ok: true });
    expect(validateSeeds([2, null, 1], 8)).toEqual({ ok: true });
  });

  it("rejects gaps, repeats, fractions and too many seeds", () => {
    expect(validateSeeds([1, 3], 8)).toEqual({
      ok: false,
      error: "Seeds must run from 1 to 2 without gaps; seed 2 is missing.",
    });
    expect(validateSeeds([1, 1], 8)).toEqual({ ok: false, error: "Each seed number can be used once." });
    expect(validateSeeds([1.5], 8)).toEqual({ ok: false, error: "Seeds must be whole numbers from 1." });
    expect(validateSeeds([1, 2, 3], 8)).toEqual({
      ok: false,
      error: "A 8-line draw has at most 2 seeds.",
    });
    expect(validateSeeds([1], 2)).toEqual({ ok: false, error: "A 2-line draw has no seeds." });
  });
});

describe("generateDraw", () => {
  it("keeps every draw rule for 2 to 64 entrants, any seed count and many lots", () => {
    for (let count = 2; count <= 64; count += 1) {
      const limit = maxSeeds(drawSize(count));
      const seedCounts = [...new Set([0, Math.min(1, limit), Math.min(3, limit), limit])];
      for (const seedCount of seedCounts) {
        for (let lot = 1; lot <= 6; lot += 1) {
          const field = entrants(count, seedCount);
          expectValidDraw(generateDraw(field, seededRandom(count * 1000 + lot)), field);
        }
      }
    }
  });

  it.each([
    [5, 8, 3],
    [9, 16, 7],
    [17, 32, 15],
  ])("never pairs two byes with %i entrants (draw of %i, %i byes)", (count, size, byes) => {
    for (let lot = 1; lot <= 50; lot += 1) {
      const field = entrants(count, maxSeeds(size));
      const lines = generateDraw(field, seededRandom(lot));
      expect(lines.filter((line) => line.entryId === null)).toHaveLength(byes);
      expectValidDraw(lines, field);
    }
  });

  it("gives the artboard's four byes to seeds 1–4 in a draw of 28", () => {
    const lines = generateDraw(entrants(28, 8), seededRandom(7));
    const byeLines = lines.filter((line) => line.entryId === null).map((line) => line.position);
    expect(byeLines).toEqual([2, 15, 18, 31]);
  });

  it("draws lots within a seed group", () => {
    const seedThreeLines = new Set(
      Array.from({ length: 40 }, (_, lot) =>
        lineOfSeed(generateDraw(entrants(32, 8), seededRandom(lot + 1)), 3),
      ),
    );
    expect([...seedThreeLines].sort((a, b) => a - b)).toEqual([16, 17]);
  });

  it("gives the same draw for the same lots", () => {
    const field = entrants(13, 4);
    expect(generateDraw(field, seededRandom(42))).toEqual(generateDraw(field, seededRandom(42)));
  });

  it("refuses invalid seeds and repeated entries", () => {
    expect(() =>
      generateDraw(
        [
          { entryId: "a", seed: 1 },
          { entryId: "b", seed: 3 },
        ],
        seededRandom(1),
      ),
    ).toThrow("A 2-line draw has no seeds.");
    expect(() =>
      generateDraw(
        [
          { entryId: "a", seed: null },
          { entryId: "a", seed: null },
        ],
        seededRandom(1),
      ),
    ).toThrow("Each entry can appear in a draw once.");
  });
});

describe("roundName", () => {
  it("names the late rounds and counts the early ones", () => {
    expect([1, 2, 4, 8, 16].map(roundName)).toEqual([
      "Final",
      "Semi-finals",
      "Quarter-finals",
      "Round of 16",
      "Round of 32",
    ]);
  });
});

describe("buildBracket", () => {
  const lines: DrawLine[] = [
    { position: 1, entryId: "seed-1", seed: 1 },
    { position: 2, entryId: null, seed: null },
    { position: 3, entryId: "c", seed: null },
    { position: 4, entryId: "d", seed: null },
    { position: 5, entryId: "e", seed: null },
    { position: 6, entryId: null, seed: null },
    { position: 7, entryId: null, seed: null },
    { position: 8, entryId: "seed-2", seed: 2 },
  ];

  it("numbers matches round by round and names each round", () => {
    const rounds = buildBracket(lines);

    expect(rounds.map((round) => round.name)).toEqual(["Quarter-finals", "Semi-finals", "Final"]);
    expect(rounds.flatMap((round) => round.matches.map((match) => match.number))).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
  });

  it("moves players with a bye straight into the next round", () => {
    const [, semis, final] = buildBracket(lines);

    expect(semis.matches[0]).toEqual({
      number: 5,
      top: { kind: "entry", entryId: "seed-1", seed: 1 },
      bottom: { kind: "winner", matchNumber: 2 },
    });
    expect(semis.matches[1]).toEqual({
      number: 6,
      top: { kind: "entry", entryId: "e", seed: null },
      bottom: { kind: "entry", entryId: "seed-2", seed: 2 },
    });
    expect(final.matches[0]).toEqual({
      number: 7,
      top: { kind: "winner", matchNumber: 5 },
      bottom: { kind: "winner", matchNumber: 6 },
    });
  });

  it("rejects lines that do not cover every position", () => {
    expect(() => buildBracket([lines[0], lines[0]])).toThrow(/cover positions/);
  });
});

describe("drawChanges", () => {
  const drawn = [
    { entryId: "a", seed: 1 },
    { entryId: "b", seed: null },
    { entryId: null, seed: null },
  ];

  it("reports nothing when entries and seeds match the draw", () => {
    const changes = drawChanges(drawn, [
      { entryId: "a", seed: 1 },
      { entryId: "b", seed: null },
    ]);
    expect(changes).toEqual({ added: [], removed: [], reseeded: [] });
    expect(hasDrawChanges(changes)).toBe(false);
  });

  it("finds new, withdrawn and reseeded entries", () => {
    const changes = drawChanges(drawn, [
      { entryId: "a", seed: null },
      { entryId: "c", seed: null },
    ]);
    expect(changes).toEqual({ added: ["c"], removed: ["b"], reseeded: ["a"] });
    expect(hasDrawChanges(changes)).toBe(true);
  });
});

describe("describeDrawChanges", () => {
  it("lists only the kinds of change that happened", () => {
    expect(describeDrawChanges({ added: ["x"], removed: [], reseeded: [] })).toBe(
      "Since this draw was made: 1 new entry.",
    );
    expect(describeDrawChanges({ added: ["x", "y"], removed: ["z"], reseeded: ["w"] })).toBe(
      "Since this draw was made: 2 new entries, 1 withdrawn, 1 reseeded.",
    );
  });
});

describe("canDraw", () => {
  it("needs 2 to 128 entrants", () => {
    expect([0, 1, 2, 128, 129].map(canDraw)).toEqual([false, false, true, true, false]);
  });
});

describe("parseSeedInput", () => {
  it("treats blank as unseeded and passes anything else on as a number", () => {
    expect(parseSeedInput("  ")).toBeNull();
    expect(parseSeedInput(" 3 ")).toBe(3);
    expect(Number.isNaN(parseSeedInput("first"))).toBe(true);
  });
});

describe("eligibleRows", () => {
  const row = (id: string, category: "MS" | "WS", status: EntryStatus) => ({
    entry: { id, category, status, seed: id === "paid" ? 1 : null },
  });

  it("keeps confirmed and paid entries in the event", () => {
    const rows = [
      row("submitted", "MS", "submitted"),
      row("confirmed", "MS", "confirmed"),
      row("paid", "MS", "paid"),
      row("cancelled", "MS", "cancelled"),
      row("other-event", "WS", "paid"),
    ];

    expect(eligibleRows(rows, "MS").map(toDrawEntrant)).toEqual([
      { entryId: "confirmed", seed: null },
      { entryId: "paid", seed: 1 },
    ]);
  });
});
