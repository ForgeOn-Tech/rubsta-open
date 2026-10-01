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
