// @vitest-environment node
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";

import { getDrawWithSlots, saveGeneratedDraw } from "@/db/draws";
import {
  advanceWinnerToNextMatch,
  deleteMatchesForDraw,
  getScoringMatch,
  listScoringMatches,
  materializeMatches,
  publishDraw,
  resetMatch,
  retireMatch,
  saveMatchScore,
  unpublishDraw,
} from "@/db/matches";
import * as schema from "@/db/schema";
import { SEED_TOURNAMENT } from "@/db/seed";
import type { DrawLine } from "@/lib/draws";
import type { MatchEvent, Side } from "@/lib/match";
import type { ScoreRecord } from "@/lib/score-record";

const TOURNAMENT_ID = "tournament-1";
const STARTED_AT = 1_700_000_000_000;

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

/** Draw in the given line order, published so its matches exist. */
function materializedDraw(database: Db, order: readonly (string | null)[]) {
  const drawId = saveGeneratedDraw(database, {
    tournamentId: TOURNAMENT_ID,
    category: "MS",
    lines: lines(order),
  });
  const current = getDrawWithSlots(database, TOURNAMENT_ID, "MS")!;
  publishDraw(database, current.draw, current.slots);
  const rows = database.select().from(schema.matches).where(eq(schema.matches.drawId, drawId)).all();
  return { draw: current.draw, matches: rows };
}

function matchByNumber(matches: schema.Match[], matchNumber: number): schema.Match {
  return matches.find((match) => match.matchNumber === matchNumber)!;
}

function loadRow(database: Db, matchId: string): schema.Match {
  return database.select().from(schema.matches).where(eq(schema.matches.id, matchId)).get()!;
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

/** A score record served first by top, with a full deciding set. */
function record(events: MatchEvent[]): ScoreRecord {
  return { firstServer: "top", decidingSet: "set", court: 1, startedAt: STARTED_AT, events };
}

/** Saves a 6–0 6–0 win for the top side in one save. */
function playStraightSets(database: Db, matchId: string): schema.Match {
  const events = [...setEvents("top", 6, 0), ...setEvents("top", 6, 0)];
  const result = saveMatchScore(database, matchId, loadRow(database, matchId).version, record(events));
  if (result.kind !== "saved") throw new Error(`Saving match ${matchId} returned a conflict.`);
  return result.match;
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
      version: 0,
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

describe("saveMatchScore", () => {
  it("starts the match with the first save and bumps the version", () => {
    const database = setup();
    const { matches } = materializedDraw(database, ["a", null, "b", "c"]);
    const match = matchByNumber(matches, 2);

    const result = saveMatchScore(database, match.id, 0, record([]));

    expect(result).toMatchObject({
      kind: "saved",
      match: {
        status: "in_progress",
        firstServer: "top",
        decidingSet: "set",
        court: 1,
        startedAt: STARTED_AT,
        events: [],
        version: 1,
      },
    });
  });

  it("replaces the events, so a shorter list undoes a point", () => {
    const database = setup();
    const { matches } = materializedDraw(database, ["a", null, "b", "c"]);
    const match = matchByNumber(matches, 2);

    saveMatchScore(database, match.id, 0, record(game("top")));
    const result = saveMatchScore(database, match.id, 1, record(game("top").slice(0, 3)));

    expect(result).toMatchObject({ kind: "saved", match: { version: 2, status: "in_progress" } });
    expect(result.match.events).toHaveLength(3);
  });

  it("keeps the court chosen at the start when later saves carry another", () => {
    const database = setup();
    const { matches } = materializedDraw(database, ["a", null, "b", "c"]);
    const match = matchByNumber(matches, 2);

    saveMatchScore(database, match.id, 0, record([]));
    const result = saveMatchScore(database, match.id, 1, { ...record([point("top")]), court: 7 });

    expect(result.match.court).toBe(1);
  });

  it("treats a retry of a save that already landed as saved", () => {
    const database = setup();
    const { matches } = materializedDraw(database, ["a", null, "b", "c"]);
    const match = matchByNumber(matches, 2);

    saveMatchScore(database, match.id, 0, record([point("top")]));
    const retry = saveMatchScore(database, match.id, 0, record([point("top")]));

    expect(retry).toMatchObject({ kind: "saved", match: { version: 1 } });
  });

  it("returns a conflict with the stored match when it changed since the base version", () => {
    const database = setup();
    const { matches } = materializedDraw(database, ["a", null, "b", "c"]);
    const match = matchByNumber(matches, 2);

    saveMatchScore(database, match.id, 0, record([point("top")]));
    const stale = saveMatchScore(database, match.id, 0, record([point("bottom")]));

    expect(stale.kind).toBe("conflict");
    expect(stale.match).toMatchObject({ version: 1, events: [point("top")] });
  });

  it("refuses a match still waiting on an earlier result", () => {
    const database = setup();
    const { matches } = materializedDraw(database, ["a", null, "b", "c"]);
    const final = matchByNumber(matches, 3);

    expect(() => saveMatchScore(database, final.id, 0, record([]))).toThrow(
      "Match 3 is waiting on an earlier result.",
    );
  });

  it("refuses events that carry on past the end of the match", () => {
    const database = setup();
    const { matches } = materializedDraw(database, ["a", null, "b", "c"]);
    const match = matchByNumber(matches, 2);
    const events = [...setEvents("top", 6, 0), ...setEvents("top", 6, 0), point("top")];

    expect(() => saveMatchScore(database, match.id, 0, record(events))).toThrow(/already complete/);
    expect(loadRow(database, match.id)).toMatchObject({ status: "scheduled", version: 0 });
  });

  it("completes a full match and advances the winner into the final", () => {
    const database = setup();
    // a plays b; c gets the bye, so the final waits on match 1.
    const { matches } = materializedDraw(database, ["a", "b", "c", null]);
    const semi = matchByNumber(matches, 1);
    const final = matchByNumber(matches, 3);

    const row = playStraightSets(database, semi.id);

    expect(row).toMatchObject({ status: "completed", winnerEntryId: "a", version: 1 });
    expect(row.completedAt).toEqual(expect.any(Number));
    expect(() => saveMatchScore(database, semi.id, row.version, record([]))).toThrow(
      "Match 1 is already complete.",
    );
    expect(loadRow(database, final.id).topSlot).toEqual({ kind: "entry", entryId: "a" });
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
  it("clears a started match back to scheduled and bumps the version", () => {
    const database = setup();
    const { matches } = materializedDraw(database, ["a", null, "b", "c"]);
    const match = matchByNumber(matches, 2);

    saveMatchScore(database, match.id, 0, { ...record([point("top")]), firstServer: "bottom" });

    const row = resetMatch(database, match.id);
    expect(row).toMatchObject({
      status: "scheduled",
      events: [],
      startedAt: null,
      firstServer: null,
      version: 2,
    });

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

    saveMatchScore(database, match.id, 0, record([]));
    const row = retireMatch(database, match.id, "bottom");

    expect(row).toMatchObject({ status: "completed", winnerEntryId: "b", version: 2 });
    expect(row.completedAt).toEqual(expect.any(Number));
    expect(loadRow(database, final.id).bottomSlot).toEqual({ kind: "entry", entryId: "b" });

    expect(() => retireMatch(database, match.id, "bottom")).toThrow(
      "The match is already complete.",
    );
  });

  it("makes a device still scoring the retired match see a conflict", () => {
    const database = setup();
    const { matches } = materializedDraw(database, ["a", null, "b", "c"]);
    const match = matchByNumber(matches, 2);

    saveMatchScore(database, match.id, 0, record([]));
    retireMatch(database, match.id, "top");
    const stale = saveMatchScore(database, match.id, 1, record([point("top")]));

    expect(stale).toMatchObject({ kind: "conflict", match: { status: "completed" } });
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

describe("publishDraw", () => {
  it("leaves the draw in draft when its matches cannot be built", () => {
    const database = setup();
    saveGeneratedDraw(database, {
      tournamentId: TOURNAMENT_ID,
      category: "MS",
      lines: lines(["a", "b", null, null]),
    });
    const current = getDrawWithSlots(database, TOURNAMENT_ID, "MS")!;

    expect(() => publishDraw(database, current.draw, current.slots)).toThrow(/two byes/);

    expect(getDrawWithSlots(database, TOURNAMENT_ID, "MS")!.draw.status).toBe("draft");
    expect(database.select().from(schema.matches).all()).toHaveLength(0);
  });
});

describe("unpublishDraw", () => {
  it("moves an unplayed draw back to draft and deletes its matches", () => {
    const database = setup();
    const { draw } = materializedDraw(database, ["a", null, "b", "c"]);

    unpublishDraw(database, draw.id);

    expect(getDrawWithSlots(database, TOURNAMENT_ID, "MS")!.draw.status).toBe("draft");
    expect(database.select().from(schema.matches).all()).toHaveLength(0);
  });

  it("refuses once a match has started, keeping the draw and its matches", () => {
    const database = setup();
    const { draw, matches } = materializedDraw(database, ["a", null, "b", "c"]);
    saveMatchScore(database, matchByNumber(matches, 2).id, 0, record([]));

    expect(() => unpublishDraw(database, draw.id)).toThrow(/have started/);

    expect(getDrawWithSlots(database, TOURNAMENT_ID, "MS")!.draw.status).toBe("published");
    expect(database.select().from(schema.matches).all()).toHaveLength(3);
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
    expect(final.category).toBe("MS");
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
    const row = getScoringMatch(database, matchByNumber(matches, 1).id);
    expect(row?.category).toBe("MS");
    expect(row?.top?.name).toBe("Asha Anand");
  });
});
