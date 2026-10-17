import { desc, eq } from "drizzle-orm";

import type { Database } from "./draws";
import { tournaments, umpireLinks, users, type UmpireLink } from "./schema";
import { isLinkActive, newUmpireToken, umpireEmailFor } from "@/lib/umpire-links";

/** Adds an umpire with a new scoring link, and the account the link signs in as. */
export function createUmpireLink(
  database: Database,
  input: { tournamentId: string; name: string; createdBy: string; now: number },
): UmpireLink {
  return database.transaction((tx) => {
    const id = crypto.randomUUID();
    const email = umpireEmailFor(id);
    tx.insert(users).values({ name: input.name, email }).run();
    return tx
      .insert(umpireLinks)
      .values({
        id,
        tournamentId: input.tournamentId,
        name: input.name,
        email,
        token: newUmpireToken(),
        createdBy: input.createdBy.toLowerCase(),
        createdAt: input.now,
      })
      .returning()
      .get();
  });
}

/** Every umpire link of a tournament, newest first, revoked ones too. */
export function listUmpireLinks(database: Database, tournamentId: string): UmpireLink[] {
  return database
    .select()
    .from(umpireLinks)
    .where(eq(umpireLinks.tournamentId, tournamentId))
    .orderBy(desc(umpireLinks.createdAt))
    .all();
}

/** Stops a link and its account scoring. Revoking twice keeps the first time. */
export function revokeUmpireLink(database: Database, linkId: string, now: number): void {
  const link = database.select().from(umpireLinks).where(eq(umpireLinks.id, linkId)).get();
  if (!link) throw new Error(`Umpire link ${linkId} does not exist.`);
  if (link.revokedAt !== null) return;
  database.update(umpireLinks).set({ revokedAt: now }).where(eq(umpireLinks.id, linkId)).run();
}

function activeLinks(database: Database, today: string) {
  return database
    .select({ link: umpireLinks, endsOn: tournaments.endsOn })
    .from(umpireLinks)
    .innerJoin(tournaments, eq(umpireLinks.tournamentId, tournaments.id))
    .all()
    .filter(({ link, endsOn }) => isLinkActive(link, endsOn, today))
    .map(({ link }) => link);
}

/** The working link with this secret, or null when it is unknown, revoked or lapsed. */
export function activeLinkByToken(database: Database, token: string, today: string): UmpireLink | null {
  return activeLinks(database, today).find((link) => link.token === token) ?? null;
}

/** True when `email` is the account of a link that still works. */
export function isActiveUmpireEmail(database: Database, email: string, today: string): boolean {
  const normalised = email.trim().toLowerCase();
  return activeLinks(database, today).some((link) => link.email === normalised);
}

/** The accounts of every working link, for assigning umpires on the order of play. */
export function listActiveUmpireEmails(database: Database, today: string): string[] {
  return activeLinks(database, today).map((link) => link.email);
}

/** The account a working link signs in as. */
export function umpireLinkAccount(database: Database, link: UmpireLink) {
  const user = database.select().from(users).where(eq(users.email, link.email)).get();
  if (!user) throw new Error(`Umpire link ${link.id} has no account ${link.email}.`);
  return user;
}
