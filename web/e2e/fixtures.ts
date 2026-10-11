import { randomUUID } from "node:crypto";

import Database from "better-sqlite3";

/** Opens the e2e database with its tournament id, runs `change`, and closes it. */
function withTournament(change: (database: Database.Database, tournamentId: string) => void): void {
  const databasePath = process.env.DATABASE_PATH;
  if (!databasePath) throw new Error("DATABASE_PATH is not set for the e2e run.");

  const database = new Database(databasePath);
  try {
    const tournament = database.prepare("select id from tournaments").get() as
      | { id: string }
      | undefined;
    if (!tournament) throw new Error(`No tournament in the e2e database at ${databasePath}.`);
    database.transaction(() => change(database, tournament.id))();
  } finally {
    database.close();
  }
}

/** Stand-in image-provider result for browser tests; all sharing routes stay real. */
export function saveDemoAvatar(png: Buffer): { version: number; userId: string } {
  const version = Date.now();
  let userId = "";
  withTournament(database => {
    const player = database.prepare("select id from users where email = ?").get("demo@rubstaopen.local") as { id: string };
    userId = player.id;
    database.prepare("delete from avatar_shares where user_id = ?").run(userId);
    database.prepare(`insert into player_avatars (user_id, png, updated_at, consent_at) values (?, ?, ?, ?)
      on conflict(user_id) do update set png=excluded.png, updated_at=excluded.updated_at, consent_at=excluded.consent_at`)
      .run(userId, png.toString("base64"), version, version);
  });
  return { version, userId };
}

/** Adds a user with a profile and returns the user id. */
function addPlayer(database: Database.Database, name: string): string {
  const userId = randomUUID();
  database.prepare("insert into users (id, name, email) values (?, ?, ?)").run(userId, name, `${userId}@example.com`);
  database
    .prepare(
      "insert into profiles (id, user_id, full_name, date_of_birth, gender, mobile) values (?, ?, ?, ?, ?, ?)",
    )
    .run(randomUUID(), userId, name, "2000-01-01", "male", "+91 90000 00000");
  return userId;
}

/**
 * Adds players with confirmed entries straight to the e2e database. The demo
 * sign-in is the only browser identity, so a draw needs these extra entrants.
 */
export function addConfirmedEntrants(category: string, names: readonly string[]): void {
  withTournament((database, tournamentId) => {
    const insertEntry = database.prepare(
      "insert into entries (id, user_id, tournament_id, category, status) values (?, ?, ?, ?, 'confirmed')",
    );
    for (const name of names) {
      insertEntry.run(randomUUID(), addPlayer(database, name), tournamentId, category);
    }
  });
}

/** Adds another player's confirmed doubles entry that names `partnerEmail` as a partner yet to answer. */
export function addDoublesInvitation(category: string, inviterName: string, partnerEmail: string): void {
  withTournament((database, tournamentId) => {
    database
      .prepare(
        `insert into entries (id, user_id, tournament_id, category, status, partner_name, partner_email, partner_status)
         values (?, ?, ?, ?, 'confirmed', ?, ?, 'pending')`,
      )
      .run(randomUUID(), addPlayer(database, inviterName), tournamentId, category, "Demo", partnerEmail);
  });
}

/** The inviter names someone else on every doubles entry this email joined, as the change-partner form does. */
export function replaceDoublesPartner(partnerEmail: string, newPartnerName: string, newPartnerEmail: string): void {
  withTournament((database) => {
    database
      .prepare(
        `update entries set partner_name = ?, partner_email = ?, partner_status = 'pending',
           partner_user_id = null, partner_responded_at = null
         where partner_email = ?`,
      )
      .run(newPartnerName, newPartnerEmail, partnerEmail);
  });
}
