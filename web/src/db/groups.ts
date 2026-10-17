import { and, asc, eq, isNotNull } from "drizzle-orm";

import type { Database } from "./draws";
import { draws, drawSlots, groupPlaces, matches, type Category, type Draw, type Match, type MatchSlot } from "./schema";
import { groupResultOf } from "@/lib/group-results";
import {
  GROUP_EVENT_QUALIFIERS,
  groupQualifiers,
  groupRoundName,
  groupStandings,
  roundRobinPairs,
  type GroupPlan,
  type GroupStandings,
} from "@/lib/groups";

/** A refused group decision. Its message is for the admin. */
export class GroupDecisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GroupDecisionError";
  }
}

/** A published group: its members in draw order, its table, and who went through. */
export interface GroupView {
  groupNumber: number;
  members: string[];
  standings: GroupStandings;
  /** By place, from 1: the entry that went through, or null while the place waits. */
  through: (string | null)[];
}

/** The plan a group draw was made with, from its number of groups. */
export function planOfGroups(category: Category, groupCount: number): GroupPlan {
  const qualifiers = GROUP_EVENT_QUALIFIERS[category];
  if (qualifiers === undefined) throw new Error(`${category} is not played in groups.`);
  return { groupCount, qualifiersPerGroup: qualifiers / groupCount };
}

/** Each group's members in draw order. Empty for a knockout draw. */
export function membersByGroup(database: Database, drawId: string): Map<number, string[]> {
  const rows = database
    .select({ groupNumber: drawSlots.groupNumber, entryId: drawSlots.entryId })
    .from(drawSlots)
    .where(and(eq(drawSlots.drawId, drawId), isNotNull(drawSlots.groupNumber)))
    .orderBy(asc(drawSlots.position))
    .all();
  const groups = new Map<number, string[]>();
  for (const row of rows) {
    if (row.groupNumber === null || row.entryId === null) continue;
    groups.set(row.groupNumber, [...(groups.get(row.groupNumber) ?? []), row.entryId]);
  }
  return groups;
}

/** Every pairing in each group as a match row, numbered from 1, group A first. */
export function groupMatchRows(draw: Draw, groups: ReadonlyMap<number, readonly string[]>) {
  let matchNumber = 0;
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .flatMap(([groupNumber, members]) =>
      roundRobinPairs(members).map(([top, bottom]) => {
        matchNumber += 1;
        const topSlot: MatchSlot = { kind: "entry", entryId: top };
        const bottomSlot: MatchSlot = { kind: "entry", entryId: bottom };
        return {
          drawId: draw.id,
          matchNumber,
          // Group matches come before the knockout, whose rounds count from 1.
          roundIndex: 0,
          roundName: groupRoundName(groupNumber),
          groupNumber,
          topSlot,
          bottomSlot,
          status: "scheduled" as const,
        };
      }),
    );
}

function throughOf(database: Database, drawId: string, groupNumber: number, places: number): (string | null)[] {
  const decided = database
    .select()
    .from(groupPlaces)
    .where(and(eq(groupPlaces.drawId, drawId), eq(groupPlaces.groupNumber, groupNumber)))
    .all();
  return Array.from({ length: places }, (_unused, index) => decided.find((row) => row.place === index + 1)?.entryId ?? null);
}

/** Every group of a group draw once published, group A first. Empty for a knockout draw. */
export function listGroups(database: Database, draw: Draw): GroupView[] {
  const groups = membersByGroup(database, draw.id);
  if (groups.size === 0) return [];
  const plan = planOfGroups(draw.category, groups.size);
  const groupMatches: Match[] = database
    .select()
    .from(matches)
    .where(and(eq(matches.drawId, draw.id), isNotNull(matches.groupNumber)))
    .all();
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([groupNumber, members]) => ({
      groupNumber,
      members,
      standings: groupStandings(
        members,
        groupMatches.filter((match) => match.groupNumber === groupNumber).map(groupResultOf),
      ),
      through: throughOf(database, draw.id, groupNumber, plan.qualifiersPerGroup),
    }));
}

function groupOf(database: Database, drawId: string, groupNumber: number): GroupView {
  const draw = database.select().from(draws).where(eq(draws.id, drawId)).get();
  if (!draw) throw new Error(`Draw ${drawId} does not exist.`);
  const view = listGroups(database, draw).find((group) => group.groupNumber === groupNumber);
  if (!view) throw new GroupDecisionError(`The draw has no group ${groupNumber}.`);
  return view;
}

function isPlaceSlot(slot: MatchSlot, groupNumber: number, place: number): boolean {
  return slot.kind === "group" && slot.group === groupNumber && slot.place === place;
}

/** Records who takes a group place and puts them into the knockout slot that waits on it. */
function sendThrough(
  database: Database,
  drawId: string,
  decision: { groupNumber: number; place: number; entryId: string; decidedBy: string; now: number },
): void {
  const { groupNumber, place } = decision;
  const target = database
    .select()
    .from(matches)
    .where(eq(matches.drawId, drawId))
    .all()
    .find((match) => isPlaceSlot(match.topSlot, groupNumber, place) || isPlaceSlot(match.bottomSlot, groupNumber, place));
  if (!target) throw new Error(`No knockout match in draw ${drawId} waits on group ${groupNumber} place ${place}.`);

  database
    .insert(groupPlaces)
    .values({ drawId, groupNumber, place, entryId: decision.entryId, decidedBy: decision.decidedBy, decidedAt: decision.now })
    .run();
  const slot: MatchSlot = { kind: "entry", entryId: decision.entryId };
  database
    .update(matches)
    .set(isPlaceSlot(target.topSlot, groupNumber, place) ? { topSlot: slot, updatedAt: decision.now } : { bottomSlot: slot, updatedAt: decision.now })
    .where(eq(matches.id, target.id))
    .run();
}

/**
 * After a group match finishes: once the whole group has, sends through each place the
 * standings decide. A place the rules leave level waits for an admin.
 */
export function fillGroupPlaces(database: Database, drawId: string, groupNumber: number, now: number): void {
  const view = groupOf(database, drawId, groupNumber);
  groupQualifiers(view.standings, view.through.length).forEach((entryId, index) => {
    if (entryId === null || view.through[index] !== null) return;
    sendThrough(database, drawId, { groupNumber, place: index + 1, entryId, decidedBy: "standings", now });
  });
}

/**
 * An admin's decision for a place the rules leave level: only once the group is finished,
 * only for a place still waiting, and only for a player level on that place.
 */
export function decideGroupPlace(
  database: Database,
  input: { drawId: string; groupNumber: number; place: number; entryId: string; adminEmail: string; now: number },
): void {
  database.transaction((tx) => {
    const view = groupOf(tx, input.drawId, input.groupNumber);
    if (!view.standings.complete) throw new GroupDecisionError("Finish every match in the group first.");
    if (input.place < 1 || input.place > view.through.length || view.through[input.place - 1] !== null) {
      throw new GroupDecisionError("That place has already been decided.");
    }
    if (view.through.includes(input.entryId)) throw new GroupDecisionError("That player is already through.");
    const row = view.standings.rows.find((standing) => standing.entryId === input.entryId);
    if (!row) throw new GroupDecisionError("That player is not in the group.");
    const levelCount = view.standings.rows.filter((standing) => standing.place === row.place).length;
    // Players level share the first of their places, so a level pair at 1 covers places 1 and 2.
    if (levelCount < 2 || input.place < row.place || input.place > row.place + levelCount - 1) {
      throw new GroupDecisionError("Only a player level on that place can take it.");
    }
    sendThrough(tx, input.drawId, {
      groupNumber: input.groupNumber,
      place: input.place,
      entryId: input.entryId,
      decidedBy: input.adminEmail.toLowerCase(),
      now: input.now,
    });
  });
}
