import { and, eq, ne, or } from "drizzle-orm";

import type { Database } from "./draws";
import {
  draws,
  drawSlots,
  entries,
  profiles,
  tournaments,
  users,
  type Category,
  type Entry,
  type Tournament,
} from "./schema";
import {
  checkPartnerChange,
  checkPartnerResponse,
  normaliseEmail,
  type PartnerDecision,
} from "@/lib/partners";

/** A partner answer or change breaks a rule. Its message is for the player. */
export class PartnerRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PartnerRejectedError";
  }
}

/** A doubles entry seen by the partner: the entry, its tournament and who made it. */
export interface PartnerInvitation {
  entry: Entry;
  tournament: Tournament;
  inviterName: string;
}

function invitationQuery(database: Database) {
  return database
    .select({
      entry: entries,
      tournament: tournaments,
      email: users.email,
      accountName: users.name,
      fullName: profiles.fullName,
    })
    .from(entries)
    .innerJoin(tournaments, eq(entries.tournamentId, tournaments.id))
    .innerJoin(users, eq(entries.userId, users.id))
    .leftJoin(profiles, eq(profiles.userId, entries.userId));
}

function toInvitation(row: {
  entry: Entry;
  tournament: Tournament;
  email: string;
  accountName: string | null;
  fullName: string | null;
}): PartnerInvitation {
  return {
    entry: row.entry,
    tournament: row.tournament,
    inviterName: row.fullName ?? row.accountName ?? row.email,
  };
}

/** One entry as a partner invitation, or null when the id does not exist. */
export function getPartnerInvitation(database: Database, entryId: string): PartnerInvitation | null {
  const row = invitationQuery(database).where(eq(entries.id, entryId)).get();
  return row ? toInvitation(row) : null;
}

/** Invitations still waiting for this email's answer, on entries that are not cancelled. */
export function listPendingInvitations(database: Database, email: string): PartnerInvitation[] {
  return invitationQuery(database)
    .where(
      and(
        eq(entries.partnerEmail, normaliseEmail(email)),
        eq(entries.partnerStatus, "pending"),
        ne(entries.status, "cancelled"),
      ),
    )
    .all()
    .map(toInvitation);
}

/** Entries this user joined by accepting an invitation. */
export function listPartneredEntries(database: Database, userId: string): PartnerInvitation[] {
  return invitationQuery(database)
    .where(and(eq(entries.partnerUserId, userId), eq(entries.partnerStatus, "accepted")))
    .all()
    .map(toInvitation);
}

/** Entries a user plays in: their own, and the doubles entries they joined as a partner. */
function playsIn(userId: string) {
  return or(
    eq(entries.userId, userId),
    and(eq(entries.partnerUserId, userId), eq(entries.partnerStatus, "accepted")),
  );
}

/** The events a user plays: their own entries and the entries they joined as a partner. */
export function listPlayedCategories(database: Database, userId: string): Category[] {
  const rows = database.select({ category: entries.category }).from(entries).where(playsIn(userId)).all();
  return [...new Set(rows.map((row) => row.category))];
}

/** Ids of the entries a user plays in, so their matches can be found in draws. */
export function listTeamEntryIds(database: Database, userId: string): string[] {
  return database
    .select({ id: entries.id })
    .from(entries)
    .where(playsIn(userId))
    .all()
    .map((row) => row.id);
}

/** True when the entry has a line in a published draw. */
export function isInPublishedDraw(database: Database, entryId: string): boolean {
  const line = database
    .select({ id: drawSlots.id })
    .from(drawSlots)
    .innerJoin(draws, eq(drawSlots.drawId, draws.id))
    .where(and(eq(drawSlots.entryId, entryId), eq(draws.status, "published")))
    .get();
  return line !== undefined;
}

/**
 * Records the partner's answer. On accepting, the entry takes the partner's
 * account and profile name, so draws show the name they chose.
 */
export function respondToInvitation(
  database: Database,
  entryId: string,
  responder: { userId: string; email: string },
  decision: PartnerDecision,
): Entry {
  return database.transaction((tx) => {
    const entry = tx.select().from(entries).where(eq(entries.id, entryId)).get();
    if (!entry) throw new Error(`Entry ${entryId} does not exist.`);
    const profile = tx
      .select({ fullName: profiles.fullName })
      .from(profiles)
      .where(eq(profiles.userId, responder.userId))
      .get();
    const check = checkPartnerResponse({
      entry,
      responder: { ...responder, hasProfile: profile !== undefined },
      decision,
      playedCategories: listPlayedCategories(tx, responder.userId),
    });
    if (!check.ok) throw new PartnerRejectedError(check.error);

    const accepted = decision === "accept";
    return tx
      .update(entries)
      .set({
        partnerStatus: accepted ? "accepted" : "declined",
        partnerUserId: accepted ? responder.userId : null,
        partnerName: accepted && profile ? profile.fullName : entry.partnerName,
        partnerRespondedAt: Date.now(),
      })
      .where(eq(entries.id, entryId))
      .returning()
      .get();
  });
}

/** Names a new partner on a player's own doubles entry, which then waits for that partner. */
export function changePartner(
  database: Database,
  entryId: string,
  player: { userId: string; email: string },
  partner: { name: string; email: string },
): Entry {
  return database.transaction((tx) => {
    const entry = tx
      .select()
      .from(entries)
      .where(and(eq(entries.id, entryId), eq(entries.userId, player.userId)))
      .get();
    if (!entry) throw new Error(`Entry ${entryId} does not belong to user ${player.userId}.`);
    const check = checkPartnerChange({
      entry,
      name: partner.name,
      email: partner.email,
      ownEmail: player.email,
      inPublishedDraw: isInPublishedDraw(tx, entryId),
    });
    if (!check.ok) throw new PartnerRejectedError(check.error);

    return tx
      .update(entries)
      .set({
        partnerName: partner.name.trim(),
        partnerEmail: normaliseEmail(partner.email),
        partnerStatus: "pending",
        partnerUserId: null,
        partnerRespondedAt: null,
      })
      .where(eq(entries.id, entryId))
      .returning()
      .get();
  });
}
