// @vitest-environment node
import Database from "better-sqlite3";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";

import { getDrawWithSlots, saveGeneratedGroups } from "@/db/draws";
import { GroupDecisionError, decideGroupPlace, listGroups } from "@/db/groups";
import { publishDraw, retireMatch, saveMatchScore, unpublishDraw, walkoverMatch } from "@/db/matches";
import * as schema from "@/db/schema";
import { SEED_TOURNAMENT } from "@/db/seed";
import type { Category } from "@/db/schema";
import { generateGroups, groupPlan } from "@/lib/groups";
import type { MatchEvent, Side } from "@/lib/match";
import { BEST_OF_THREE, EIGHT_GAMES, ONE_SET, formatFor } from "@/lib/match-formats";
import type { ScoreRecord } from "@/lib/score-record";

const TOURNAMENT_ID = "tournament-1";
const STARTED_AT = 1_700_000_000_000;
const ADMIN = "admin@example.com";

type Db = ReturnType<typeof drizzle<typeof schema>>;

function setup(category: Category, count: number) {
  const database = drizzle(new Database(":memory:"), { schema });
  migrate(database, { migrationsFolder: "./drizzle" });
  database.insert(schema.tournaments).values({ id: TOURNAMENT_ID, ...SEED_TOURNAMENT }).run();
  const plan = groupPlan(category, count)!;
  for (let index = 1; index <= count; index++) {
    database.insert(schema.users).values({ id: `user-${index}`, email: `p${index}@example.com`, name: `P${index}` }).run();
    database
      .insert(schema.entries)
      .values({
        id: `e${index}`,
        userId: `user-${index}`,
        tournamentId: TOURNAMENT_ID,
        category,
        status: "paid",
        seed: index <= plan.groupCount ? index : null,
      })
      .run();
  }
  const entrants = Array.from({ length: count }, (_unused, index) => ({
    entryId: `e${index + 1}`,
    seed: index < plan.groupCount ? index + 1 : null,
  }));
  saveGeneratedGroups(database, { tournamentId: TOURNAMENT_ID, category, qualifiersPerGroup: plan.qualifiersPerGroup, lines: generateGroups(entrants, plan, Math.random) });
  const current = getDrawWithSlots(database, TOURNAMENT_ID, category)!;
  publishDraw(database, current.draw, current.slots);
  return { database, draw: current.draw };
}

function matchesOf(database: Db, drawId: string): schema.Match[] {
  return database.select().from(schema.matches).where(eq(schema.matches.drawId, drawId)).all();
}

function groupMatches(database: Db, drawId: string, group: number): schema.Match[] {
  return database
    .select()
    .from(schema.matches)
    .where(and(eq(schema.matches.drawId, drawId), eq(schema.matches.groupNumber, group)))
    .all();
}

function points(side: Side, count: number): MatchEvent[] {
  return Array.from({ length: count }, () => ({ type: "point", side }) as const);
}

/** Games won to love, alternating, ending `winnerGames`–`loserGames` to the winner. */
function setTo(winner: Side, winnerGames: number, loserGames: number): MatchEvent[] {
  const loser: Side = winner === "top" ? "bottom" : "top";
  const events: MatchEvent[] = [];
  for (let index = 0; index < winnerGames; index++) {
    if (index < loserGames) events.push(...points(loser, 4));
    events.push(...points(winner, 4));
  }
  return events;
}

function record(events: MatchEvent[]): ScoreRecord {
  return { firstServer: "top", decidingSet: "set", format: ONE_SET, court: 1, startedAt: STARTED_AT, events };
}

/** Plays a group match to a one-set result for the given entry. */
function play(database: Db, match: schema.Match, winnerEntryId: string, loserGames: number): void {
  const winner: Side = match.topSlot.kind === "entry" && match.topSlot.entryId === winnerEntryId ? "top" : "bottom";
  const result = saveMatchScore(database, match.id, match.version, record(setTo(winner, 6, loserGames)));
  expect(result.kind).toBe("saved");
}

function entryOf(slot: schema.MatchSlot): string | null {
  return slot.kind === "entry" ? slot.entryId : null;
}

describe("a group draw", () => {
  it("publishes every group pairing, then a knockout waiting on group places", () => {
    // Act: 16 Open singles entrants make 4 groups of 4, two through from each.
    const { database, draw } = setup("OS", 16);

    // Assert
    const rows = matchesOf(database, draw.id);
    const group = rows.filter((match) => match.groupNumber !== null);
    const knockout = rows.filter((match) => match.groupNumber === null).sort((a, b) => a.matchNumber - b.matchNumber);
    expect(group).toHaveLength(24);
    expect(group.every((match) => match.roundIndex === 0 && /^Group [A-D]$/.test(match.roundName))).toBe(true);
    expect(knockout.map((match) => [match.matchNumber, match.roundIndex, match.roundName])).toEqual([
      [25, 1, "Quarter-finals"],
      [26, 1, "Quarter-finals"],
      [27, 1, "Quarter-finals"],
      [28, 1, "Quarter-finals"],
      [29, 2, "Semi-finals"],
      [30, 2, "Semi-finals"],
      [31, 3, "Final"],
    ]);
    expect(knockout[0]).toMatchObject({ topSlot: { kind: "group", group: 1, place: 1 }, bottomSlot: { kind: "group", group: 2, place: 2 } });
    expect(knockout[4].topSlot).toEqual({ kind: "winner", matchNumber: 25 });
  });

  it("sends the winner and runner-up through once the group is finished", () => {
    // Arrange
    const { database, draw } = setup("OS", 16);
    const groupA = groupMatches(database, draw.id, 1);
    const members = listGroups(database, draw)[0].members;
    const rank = (entryId: string) => members.indexOf(entryId);

    // Act: the earlier member in the draw wins every match.
    for (const match of groupA.slice(0, -1)) {
      const [top, bottom] = [entryOf(match.topSlot)!, entryOf(match.bottomSlot)!];
      play(database, match, rank(top) < rank(bottom) ? top : bottom, 2);
    }
    const quarterBeforeLast = matchesOf(database, draw.id).find((match) => match.matchNumber === 25)!;
    const last = groupA.at(-1)!;
    const [top, bottom] = [entryOf(last.topSlot)!, entryOf(last.bottomSlot)!];
    play(database, last, rank(top) < rank(bottom) ? top : bottom, 2);

    // Assert
    expect(quarterBeforeLast.topSlot.kind).toBe("group");
    const view = listGroups(database, draw)[0];
    expect(view.standings.complete).toBe(true);
    expect(view.through).toEqual([members[0], members[1]]);
    const after = matchesOf(database, draw.id);
    expect(after.find((match) => match.matchNumber === 25)!.topSlot).toEqual({ kind: "entry", entryId: members[0] });
    // Group A's runner-up waits for Group B's winner.
    const runnerUpMatch = after.find((match) => match.groupNumber === null && [match.topSlot, match.bottomSlot].some((slot) => entryOf(slot) === members[1]));
    expect(runnerUpMatch?.roundName).toBe("Quarter-finals");
    expect([runnerUpMatch?.topSlot, runnerUpMatch?.bottomSlot]).toContainEqual({ kind: "group", group: 2, place: 1 });
    expect(database.select().from(schema.groupPlaces).all().map((row) => row.decidedBy)).toEqual(["standings", "standings"]);
  });

  it("counts a walkover and a retirement in the group and still fills the places", () => {
    const { database, draw } = setup("S40", 12);
    const groupA = groupMatches(database, draw.id, 1);
    const members = listGroups(database, draw)[0].members;
    expect(groupA).toHaveLength(3);

    walkoverMatch(database, groupA[0].id, entryOf(groupA[0].topSlot) === members[0] ? "bottom" : "top");
    const started = saveMatchScore(database, groupA[1].id, 0, record(points("top", 4)));
    expect(started.kind).toBe("saved");
    retireMatch(database, groupA[1].id, entryOf(groupA[1].topSlot) === members[0] ? "bottom" : "top");
    play(database, groupA[2], entryOf(groupA[2].topSlot)!, 0);

    const view = listGroups(database, draw)[0];
    expect(view.standings.complete).toBe(true);
    expect(view.through[0]).not.toBeNull();
    const semis = matchesOf(database, draw.id).filter((match) => match.roundName === "Semi-finals");
    expect(semis.some((match) => entryOf(match.topSlot) === view.through[0] || entryOf(match.bottomSlot) === view.through[0])).toBe(true);
  });

  it("waits for an admin when the rules leave players level, and takes only a level player", () => {
    // Arrange: a three-way cycle, every match 6–4, in 40+ singles group A.
    const { database, draw } = setup("S40", 12);
    const groupA = groupMatches(database, draw.id, 1);
    const members = listGroups(database, draw)[0].members;
    const [x, y, z] = members;
    const beats = new Map([[x, y], [y, z], [z, x]]);
    for (const match of groupA) {
      const [top, bottom] = [entryOf(match.topSlot)!, entryOf(match.bottomSlot)!];
      play(database, match, beats.get(top) === bottom ? top : bottom, 4);
    }
    expect(listGroups(database, draw)[0].through).toEqual([null]);

    // Act and assert
    const decide = (entryId: string, place: number) =>
      decideGroupPlace(database, { drawId: draw.id, groupNumber: 1, place, entryId, adminEmail: ADMIN, now: 1 });
    expect(() => decide(x, 2)).toThrow(GroupDecisionError);
    expect(() => decide("e99", 1)).toThrow(/not in the group/);
    decide(y, 1);
    expect(listGroups(database, draw)[0].through).toEqual([y]);
    expect(() => decide(z, 1)).toThrow(/already been decided/);
    expect(database.select().from(schema.groupPlaces).get()).toMatchObject({ entryId: y, decidedBy: ADMIN });
  });

  it("refuses an admin decision before the group is finished", () => {
    const { database, draw } = setup("S40", 12);
    const members = listGroups(database, draw)[0].members;

    expect(() =>
      decideGroupPlace(database, { drawId: draw.id, groupNumber: 1, place: 1, entryId: members[0], adminEmail: ADMIN, now: 1 }),
    ).toThrow(/Finish every match/);
  });

  it("puts eight group winners into the quarter-finals and moves a winner on across the numbering", () => {
    const { database, draw } = setup("OS", 24);
    const rows = matchesOf(database, draw.id);
    const groupCount = rows.filter((match) => match.groupNumber !== null).length;
    const quarters = rows.filter((match) => match.roundName === "Quarter-finals").sort((a, b) => a.matchNumber - b.matchNumber);
    expect(quarters[0]).toMatchObject({
      matchNumber: groupCount + 1,
      topSlot: { kind: "group", group: 1, place: 1 },
      bottomSlot: { kind: "group", group: 8, place: 1 },
    });

    // Fill both sides of the first quarter-final from groups A and H, then play it.
    for (const group of [1, 8]) {
      const members = listGroups(database, draw)[group - 1].members;
      for (const match of groupMatches(database, draw.id, group)) {
        const [top, bottom] = [entryOf(match.topSlot)!, entryOf(match.bottomSlot)!];
        play(database, match, members.indexOf(top) < members.indexOf(bottom) ? top : bottom, 1);
      }
    }
    const quarter = matchesOf(database, draw.id).find((match) => match.id === quarters[0].id)!;
    expect(formatFor("OS", quarter.roundName)).toEqual(EIGHT_GAMES);
    const won = saveMatchScore(database, quarter.id, quarter.version, {
      ...record(setTo("top", 8, 0)),
      format: EIGHT_GAMES,
    });
    expect(won).toMatchObject({ kind: "saved", match: { status: "completed" } });
    const semi = matchesOf(database, draw.id).find(
      (match) => match.roundName === "Semi-finals" && (entryOf(match.topSlot) !== null || entryOf(match.bottomSlot) !== null),
    );
    expect(semi).toBeDefined();
    expect(formatFor("OS", "Semi-finals")).toEqual(BEST_OF_THREE);
  });

  it("plays the groups the admin chose: 16 players in 2 groups, the top 2 to the semi-finals", () => {
    // Arrange
    const database = drizzle(new Database(":memory:"), { schema });
    migrate(database, { migrationsFolder: "./drizzle" });
    database.insert(schema.tournaments).values({ id: TOURNAMENT_ID, ...SEED_TOURNAMENT }).run();
    for (let index = 1; index <= 16; index++) {
      database.insert(schema.users).values({ id: `user-${index}`, email: `p${index}@example.com`, name: `P${index}` }).run();
      database.insert(schema.entries).values({ id: `e${index}`, userId: `user-${index}`, tournamentId: TOURNAMENT_ID, category: "OS", status: "paid" }).run();
    }
    const plan = { groupCount: 2, qualifiersPerGroup: 2 };
    const entrants = Array.from({ length: 16 }, (_unused, index) => ({ entryId: `e${index + 1}`, seed: null }));

    // Act
    saveGeneratedGroups(database, { tournamentId: TOURNAMENT_ID, category: "OS", qualifiersPerGroup: 2, lines: generateGroups(entrants, plan, Math.random) });
    const current = getDrawWithSlots(database, TOURNAMENT_ID, "OS")!;
    publishDraw(database, current.draw, current.slots);

    // Assert
    expect(current.draw.qualifiersPerGroup).toBe(2);
    const rows = matchesOf(database, current.draw.id);
    expect(rows.filter((match) => match.groupNumber !== null)).toHaveLength(56);
    expect(rows.filter((match) => match.groupNumber === null).map((match) => match.roundName)).toEqual(["Semi-finals", "Semi-finals", "Final"]);
    expect(listGroups(database, current.draw).map((group) => group.through)).toEqual([[null, null], [null, null]]);
  });

  it("forgets who went through when the draw goes back to draft before play", () => {
    const { database, draw } = setup("S40", 12);

    unpublishDraw(database, draw.id);

    expect(matchesOf(database, draw.id)).toEqual([]);
    expect(database.select().from(schema.groupPlaces).all()).toEqual([]);
  });
});
