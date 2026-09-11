import { randomUUID } from "node:crypto";

import Database from "better-sqlite3";

/**
 * Adds players with confirmed entries straight to the e2e database. The demo
 * sign-in is the only browser identity, so a draw needs these extra entrants.
 */
export function addConfirmedEntrants(category: string, names: readonly string[]): void {
  const databasePath = process.env.DATABASE_PATH;
  if (!databasePath) throw new Error("DATABASE_PATH is not set for the e2e run.");

  const database = new Database(databasePath);
  try {
    const tournament = database.prepare("select id from tournaments").get() as
      | { id: string }
      | undefined;
    if (!tournament) throw new Error(`No tournament in the e2e database at ${databasePath}.`);

    const insertUser = database.prepare("insert into users (id, name, email) values (?, ?, ?)");
    const insertProfile = database.prepare(
      "insert into profiles (id, user_id, full_name, date_of_birth, gender, mobile) values (?, ?, ?, ?, ?, ?)",
    );
    const insertEntry = database.prepare(
      "insert into entries (id, user_id, tournament_id, category, status) values (?, ?, ?, ?, 'confirmed')",
    );

    database.transaction(() => {
      for (const name of names) {
        const userId = randomUUID();
        insertUser.run(userId, name, `${userId}@example.com`);
        insertProfile.run(randomUUID(), userId, name, "2000-01-01", "male", "+91 90000 00000");
        insertEntry.run(randomUUID(), userId, tournament.id, category);
      }
    })();
  } finally {
    database.close();
  }
}
