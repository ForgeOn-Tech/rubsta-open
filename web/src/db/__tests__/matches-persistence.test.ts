// @vitest-environment node
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";

import { getDrawWithSlots, saveGeneratedDraw } from "@/db/draws";
import {
  advanceWinnerToNextMatch,
  appendMatchEvent,
  deleteMatchesForDraw,
  getScoringMatch,
  listScoringMatches,
  materializeMatches,
  resetMatch,
  retireMatch,
  startMatch,
  undoLastMatchEvent,
} from "@/db/matches";
import * as schema from "@/db/schema";
import { SEED_TOURNAMENT } from "@/db/seed";
import type { DrawLine } from "@/lib/draws";
import { deriveState, standardFormat, type MatchEvent, type Side } from "@/lib/match";

const TOURNAMENT_ID = "tournament-1";

function setup() {
  const database = drizzle(new Database(":memory:"), { schema });
  migrate(database, { migrationsFolder: "./drizzle" });
  database.insert(schema.tournaments).values({ id: TOURNAMENT_ID, ...SEED_TOURNAMENT }).run();

  const players = [
    { id: "a", status: "paid" as const, seed: 1, name: null, fullName: "Asha Anand" },
    { id: "b", status: "confirmed" as const, seed: 2, name: null, fullName: null },
    { id: "c", status: "confirmed" as const, seed: null, name: "B Player", fullName: null },
  ];
  for (const player of players) {
    database
      .insert(schema.users)
      .values({ id: `user-${player.id}`, email: `${player.id}@example.com`, name: player.name })
      .run();
    database
      .insert(schema.entries)
      .values({
        id: player.id,
        userId: `user-${player.id}`,
        tournamentId: TOURNAMENT_ID,
        category: "MS",
        status: player.status,
        seed: player.seed,
      })
      .run();
    if (player.fullName !== null) {
      database
        .insert(schema.profiles)
        .values({
          userId: `user-${player.id}`,
          fullName: player.fullName,
          dateOfBirth: "1990-01-01",
          gender: "female",
          mobile: "1234567890",
        })
        .run();
    }
  }
  return database;
}

function lines(order: readonly (string | null)[]): DrawLine[] {
  return order.map((entryId, index) => ({ position: index + 1, entryId, seed: null }));
}

type Db = ReturnType<typeof setup>;

/** Draw in the given line order, materialized into matches. */
function materializedDraw(database: Db, order: readonly (string | null)[]) {
  const drawId = saveGeneratedDraw(database, {
    tournamentId: TOURNAMENT_ID,
    category: "MS",
    lines: lines(order),
  });
  const current = getDrawWithSlots(database, TOURNAMENT_ID, "MS")!;
  materializeMatches(database, current.draw, current.slots);
  const rows = database.select().from(schema.matches).where(eq(schema.matches.drawId, drawId)).all();
  return { draw: current.draw, matches: rows };
}

function matchByNumber(matches: schema.Match[], matchNumber: number): schema.Match {
  return matches.find((match) => match.matchNumber === matchNumber)!;
}

// ── Match-event builders (same shape as lib/__tests__/match.test.ts) ──────

function point(side: Side): MatchEvent {
  return { type: "point", side };
}

/** One game from 0–0: four straight points. */
function game(side: Side): MatchEvent[] {
  return Array.from({ length: 4 }, () => point(side));
}

/** Games for each side in order, e.g. setEvents("top", 6, 0). */
function setEvents(side: Side, won: number, lost: number): MatchEvent[] {
  const other = side === "top" ? "bottom" : "top";
  const events: MatchEvent[] = [];
  for (let index = 0; index < Math.max(won, lost); index += 1) {
    if (index < won) events.push(...game(side));
    if (index < lost) events.push(...game(other));
  }
  return events;
}

/** Starts the match and plays the top side to a 6–0 6–0 win. */
function playStraightSets(database: Db, matchId: string): schema.Match {
  const started = startMatch(database, matchId, { firstServer: "top", court: 1, decidingSet: "set" });
  const events = [...setEvents("top", 6, 0), ...setEvents("top", 6, 0)];
  return events.reduce((_row, event) => appendMatchEvent(database, matchId, event), started);
}

describe("materializeMatches", () => {
  it("builds one row per bracket match, completing the bye match", () => {
    const database = setup();
    const { matches } = materializedDraw(database, ["a", null, "b", "c"]);

    expect(matches).toHaveLength(3);
    const [first, second, final] = [matchByNumber(matches, 1), matchByNumber(matches, 2), matchByNumber(matches, 3)];

    expect(first).toMatchObject({
      roundIndex: 0,
      roundName: "Semi-finals",
      topSlot: { kind: "entry", entryId: "a" },
      bottomSlot: { kind: "bye" },
      status: "completed",
      winnerEntryId: "a",
      events: [],
      court: null,
    });
    expect(first.completedAt).toEqual(expect.any(Number));

    expect(second).toMatchObject({
      roundIndex: 0,
      roundName: "Semi-finals",
      topSlot: { kind: "entry", entryId: "b" },
      bottomSlot: { kind: "entry", entryId: "c" },
      status: "scheduled",
      winnerEntryId: null,
    });

    expect(final).toMatchObject({
      roundIndex: 1,
      roundName: "Final",
      topSlot: { kind: "entry", entryId: "a" },
      bottomSlot: { kind: "winner", matchNumber: 2 },
      status: "scheduled",
    });
  });

  it("refuses a bracket where both slots of a match are byes", () => {
    const database = setup();
    saveGeneratedDraw(database, {
      tournamentId: TOURNAMENT_ID,
      category: "MS",
      lines: lines(["a", "b", null, null]),
    });
    const current = getDrawWithSlots(database, TOURNAMENT_ID, "MS")!;

    expect(() => materializeMatches(database, current.draw, current.slots)).toThrow(/two byes/);
    expect(database.select().from(schema.matches).all()).toHaveLength(0);
  });
});

describe("startMatch", () => {
  it("rejects a match still waiting on an earlier result", () => {
    const database = setup();
    const { matches } = materializedDraw(database, ["a", null, "b", "c"]);
    const final = matchByNumber(matches, 3);

    expect(() =>
      startMatch(database, final.id, { firstServer: "top", court: 1, decidingSet: "set" }),
    ).toThrow("Both players must be known before scoring.");
  });

  it("rejects an already-started match", () => {
    const database = setup();
    const { matches } = materializedDraw(database, ["a", null, "b", "c"]);
    const match = matchByNumber(matches, 2);

    startMatch(database, match.id, { firstServer: "top", court: 2, decidingSet: "set" });

    expect(() =>
      startMatch(database, match.id, { firstServer: "top", court: 2, decidingSet: "set" }),
    ).toThrow("The match has already started.");
  });
});

describe("scoring a match", () => {
  it("appends events, agrees with deriveState, and undoes back to scheduled", () => {
    const database = setup();
    const { matches } = materializedDraw(database, ["a", null, "b", "c"]);
    const match = matchByNumber(matches, 2);

    const started = startMatch(database, match.id, {
      firstServer: "top",
      court: 3,
      decidingSet: "set",
    });
    expect(started).toMatchObject({ status: "in_progress", firstServer: "top", court: 3 });
    expect(started.startedAt).toEqual(expect.any(Number));

    let row = started;
    for (let index = 0; index < 4; index += 1) {
      row = appendMatchEvent(database, match.id, point("top"));
    }
    expect(row.status).toBe("in_progress");
    expect(row.events).toHaveLength(4);
    const derived = deriveState(row.events, standardFormat(row.decidingSet), row.firstServer!);
    expect(derived.games).toEqual({ top: 1, bottom: 0 });

    for (let index = 0; index < 3; index += 1) {
      row = undoLastMatchEvent(database, match.id);
      expect(row.status).toBe("in_progress");
    }
    row = undoLastMatchEvent(database, match.id);
    expect(row).toMatchObject({ status: "scheduled", events: [], startedAt: null });

    expect(() => undoLastMatchEvent(database, match.id)).toThrow("Nothing to undo.");
  });

  it("refuses events before the match starts", () => {
    const database = setup();
    const { matches } = materializedDraw(database, ["a", null, "b", "c"]);
    const match = matchByNumber(matches, 2);

    expect(() => appendMatchEvent(database, match.id, point("top"))).toThrow(
      "Start the match first.",
    );
  });

  it("completes a full match and advances the winner into the final", () => {
    const database = setup();
    // a plays b; c gets the bye, so the final waits on match 1.
    const { matches } = materializedDraw(database, ["a", "b", "c", null]);
    const semi = matchByNumber(matches, 1);
    const final = matchByNumber(matches, 3);

    startMatch(database, semi.id, { firstServer: "top", court: 1, decidingSet: "set" });
    const events = [...setEvents("top", 6, 0), ...setEvents("top", 6, 0)];
    let row = semi;
    for (const event of events) {
      row = appendMatchEvent(database, semi.id, event);
    }

    expect(row).toMatchObject({ status: "completed", winnerEntryId: "a" });
    expect(row.completedAt).toEqual(expect.any(Number));
    expect(() => appendMatchEvent(database, semi.id, point("top"))).toThrow(
      "The match is already complete.",
    );

    const updatedFinal = database
      .select()
      .from(schema.matches)
      .where(eq(schema.matches.id, final.id))
      .get()!;
    expect(updatedFinal.topSlot).toEqual({ kind: "entry", entryId: "a" });
  });

  it("completes the final without advancing anyone", () => {
    const database = setup();
    const { matches } = materializedDraw(database, ["a", null, "b", "c"]);
    const semi = matchByNumber(matches, 2);
    const final = matchByNumber(matches, 3);

    playStraightSets(database, semi.id);
    const row = playStraightSets(database, final.id);

    expect(row).toMatchObject({ status: "completed", winnerEntryId: "a" });
    expect(() => advanceWinnerToNextMatch(database, row)).toThrow(/waits on match 3/);
  });

  it("refuses to advance a match that has no winner", () => {
    const database = setup();
    const { matches } = materializedDraw(database, ["a", "b", "c", null]);
    const semi = matchByNumber(matches, 1);

    expect(() => advanceWinnerToNextMatch(database, semi)).toThrow(/no winner to advance/);
  });
});

describe("resetMatch", () => {
  it("clears a started match back to scheduled", () => {
    const database = setup();
    const { matches } = materializedDraw(database, ["a", null, "b", "c"]);
    const match = matchByNumber(matches, 2);

    startMatch(database, match.id, { firstServer: "bottom", court: 1, decidingSet: "set" });
    appendMatchEvent(database, match.id, point("top"));

    const row = resetMatch(database, match.id);
    expect(row).toMatchObject({ status: "scheduled", events: [], startedAt: null, firstServer: null });

    expect(() => resetMatch(database, match.id)).toThrow(/in progress/);
  });

  it("refuses to reset a completed match", () => {
    const database = setup();
    const { matches } = materializedDraw(database, ["a", null, "b", "c"]);
    const byeMatch = matchByNumber(matches, 1);

    expect(() => resetMatch(database, byeMatch.id)).toThrow(/in progress/);
  });
});

describe("retireMatch", () => {
  it("completes the match with the other side winning and advances them", () => {
    const database = setup();
    const { matches } = materializedDraw(database, ["a", null, "b", "c"]);
    const match = matchByNumber(matches, 2);
    const final = matchByNumber(matches, 3);

    startMatch(database, match.id, { firstServer: "top", court: 1, decidingSet: "set" });
    const row = retireMatch(database, match.id, "bottom");

    expect(row).toMatchObject({ status: "completed", winnerEntryId: "b" });
    expect(row.completedAt).toEqual(expect.any(Number));

    const updatedFinal = database
      .select()
      .from(schema.matches)
      .where(eq(schema.matches.id, final.id))
      .get()!;
    expect(updatedFinal.bottomSlot).toEqual({ kind: "entry", entryId: "b" });

    expect(() => retireMatch(database, match.id, "bottom")).toThrow(
      "The match is already complete.",
    );
  });

  it("retires the final without advancing anyone", () => {
    const database = setup();
    const { matches } = materializedDraw(database, ["a", null, "b", "c"]);
    playStraightSets(database, matchByNumber(matches, 2).id);

    const row = retireMatch(database, matchByNumber(matches, 3).id, "top");

    expect(row).toMatchObject({ status: "completed", winnerEntryId: "b" });
  });

  it("records a start time when a scheduled match is retired", () => {
    const database = setup();
    const { matches } = materializedDraw(database, ["a", null, "b", "c"]);
    const match = matchByNumber(matches, 2);

    const row = retireMatch(database, match.id, "top");

    expect(row).toMatchObject({ status: "completed", winnerEntryId: "c" });
    expect(row.startedAt).toEqual(expect.any(Number));
    expect(row.completedAt).toEqual(expect.any(Number));
  });
});

describe("deleteMatchesForDraw", () => {
  it("removes every match of the draw", () => {
    const database = setup();
    const { draw } = materializedDraw(database, ["a", null, "b", "c"]);

    deleteMatchesForDraw(database, draw.id);

    expect(database.select().from(schema.matches).all()).toHaveLength(0);
  });
});

describe("listScoringMatches", () => {
  it("assembles side info and orders latest round first", () => {
    const database = setup();
    materializedDraw(database, ["a", null, "b", "c"]);

    const rows = listScoringMatches(database, TOURNAMENT_ID);
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.match.matchNumber)).toEqual([3, 1, 2]);

    const final = rows[0];
    expect(final.top).toEqual({ entryId: "a", seed: 1, name: "Asha Anand", partnerName: null });
    expect(final.bottom).toBeNull();

    const byeMatch = rows[1];
    expect(byeMatch.top?.name).toBe("Asha Anand");
    expect(byeMatch.bottom).toBeNull();

    const played = rows[2];
    expect(played.top).toEqual({ entryId: "b", seed: 2, name: "b@example.com", partnerName: null });
    expect(played.bottom?.name).toBe("B Player");
  });

  it("returns null for an unknown match id", () => {
    const database = setup();
    const { matches } = materializedDraw(database, ["a", null, "b", "c"]);

    expect(getScoringMatch(database, "no-such-match")).toBeNull();
    expect(getScoringMatch(database, matchByNumber(matches, 1).id)?.top?.name).toBe("Asha Anand");
  });
});
