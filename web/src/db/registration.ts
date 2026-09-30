import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Database } from "./draws";
import { isInPublishedDraw } from "./partners";
import { entries, entryBundles, payments, tournaments, type Category, type Entry } from "./schema";
import { entriesOpen } from "@/lib/entries";
import { isPayable } from "@/lib/entry-status";
import { comboPartner } from "@/lib/registration-pricing";

/** The player cannot change this selection. Its message is for the player. */
export class SelectionRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SelectionRejectedError";
  }
}

/** A paid single event that a new event can top up to a combo, and what it cost. */
export interface TopUpBase {
  entry: Entry;
  amountPaidCents: number;
}

/**
 * Whether the player has paid, and the unpaid checkout to finish first. A paid player can
 * still add categories, but an unpaid checkout comes before any new selection.
 */
export function registrationState(database: Database, userId: string, tournamentId?: string) {
  const owned = database.select().from(entries).where(and(
    eq(entries.userId, userId),
    tournamentId ? eq(entries.tournamentId, tournamentId) : undefined,
  )).all();
  const captured = database.select({ entryId: payments.entryId }).from(payments)
    .where(and(eq(payments.userId, userId), eq(payments.status, "paid"))).all();
  const paid = owned.some(entry => entry.status === "paid" || entry.paymentRef !== null || captured.some(payment => payment.entryId === entry.id));
  const pending = owned.find(entry => isPayable(entry.status));
  return { paid, pendingId: pending?.id ?? null };
}

/** What the entry's own Razorpay payment cost, or null when it was not paid online. */
export function capturedAmount(database: Database, entry: Entry): number | null {
  if (!entry.paymentRef) return null;
  const payment = database.select({ amountCents: payments.amountCents }).from(payments).where(and(
    eq(payments.entryId, entry.id),
    eq(payments.paymentId, entry.paymentRef),
    eq(payments.status, "paid"),
  )).get();
  return payment?.amountCents ?? null;
}

/**
 * The player's paid single that forms an approved combo with `category`, or null. An entry
 * already in a bundle has had its combo discount, so it cannot be topped up again.
 */
export function topUpBase(database: Database, userId: string, tournamentId: string, category: Category): TopUpBase | null {
  const singles = database.select().from(entries).where(and(
    eq(entries.userId, userId),
    eq(entries.tournamentId, tournamentId),
    eq(entries.status, "paid"),
    isNull(entries.bundleId),
  )).all()
    .map(entry => ({ entry, amountPaidCents: capturedAmount(database, entry) }))
    .filter((single): single is TopUpBase => single.amountPaidCents !== null);
  const partner = comboPartner(category, singles.map(single => single.entry.category));
  return singles.find(single => single.entry.category === partner) ?? null;
}

/**
 * The bundle new entries for `categories` join, or null for a plain single event. A combo
 * gets a new bundle. A single event that completes a combo with a paid single also gets
 * one, and the paid entry joins it, so checkout charges only the top-up.
 */
export function bundleForSelection(
  database: Database,
  userId: string,
  tournamentId: string,
  categories: readonly Category[],
): string | null {
  const base = categories.length === 1 ? topUpBase(database, userId, tournamentId, categories[0]) : null;
  if (categories.length !== 2 && !base) return null;
  const bundleId = crypto.randomUUID();
  database.insert(entryBundles).values({ id: bundleId, userId, tournamentId }).run();
  if (base) database.update(entries).set({ bundleId }).where(eq(entries.id, base.entry.id)).run();
  return bundleId;
}

/** The unpaid entries a change of selection would cancel: the entry and its bundle's unpaid members. */
function unpaidSelection(database: Database, entry: Entry): Entry[] {
  const members = entry.bundleId
    ? database.select().from(entries).where(and(eq(entries.bundleId, entry.bundleId), eq(entries.userId, entry.userId))).all()
    : [entry];
  return members.filter(member => isPayable(member.status));
}

/** Why the player cannot cancel this checkout and choose again, or null when they can. */
export function selectionChangeBlock(database: Database, entry: Entry): string | null {
  if (!isPayable(entry.status)) return "This entry is paid or cancelled, so it cannot be changed here.";
  const tournament = database.select().from(tournaments).where(eq(tournaments.id, entry.tournamentId)).get();
  if (!tournament || !entriesOpen(tournament)) return "Entries are closed, so this selection cannot be changed.";
  if (unpaidSelection(database, entry).some(member => isInPublishedDraw(database, member.id))) {
    return "This entry is in a published draw, so it cannot be changed.";
  }
  return null;
}

/**
 * Cancels the player's unpaid checkout so they can choose again, while entries are open and
 * no published draw holds it. A paid event in the same bundle (a top-up) stays paid and
 * leaves the bundle, so it can be topped up again.
 */
export function cancelSelection(database: Database, entryId: string, userId: string): void {
  database.transaction((tx) => {
    const entry = tx.select().from(entries).where(and(eq(entries.id, entryId), eq(entries.userId, userId))).get();
    if (!entry) throw new Error(`Entry ${entryId} does not belong to user ${userId}.`);
    const block = selectionChangeBlock(tx, entry);
    if (block) throw new SelectionRejectedError(block);
    const unpaidIds = unpaidSelection(tx, entry).map(member => member.id);
    tx.update(entries).set({ status: "cancelled" }).where(inArray(entries.id, unpaidIds)).run();
    if (entry.bundleId) {
      tx.update(entries)
        .set({ bundleId: null })
        .where(and(eq(entries.bundleId, entry.bundleId), eq(entries.status, "paid")))
        .run();
    }
  });
}
