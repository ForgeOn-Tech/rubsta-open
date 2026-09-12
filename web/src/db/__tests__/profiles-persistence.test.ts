// @vitest-environment node
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";

import { upsertProfile, type ProfileFields } from "@/db/profiles";
import * as schema from "@/db/schema";

const FIELDS: ProfileFields = {
  fullName: "Gaurav Pillai",
  dateOfBirth: "2007-03-14",
  gender: "male",
  mobile: "+91 90000 00000",
  club: null,
  bestRanking: null,
  previousTournaments: [],
  plays: null,
};

function setup() {
  const database = drizzle(new Database(":memory:"), { schema });
  migrate(database, { migrationsFolder: "./drizzle" });
  for (const id of ["first", "second"]) {
    database.insert(schema.users).values({ id, email: `${id}@example.com` }).run();
  }
  return database;
}

describe("upsertProfile", () => {
  it("gives each new profile the next player number", () => {
    const database = setup();

    expect(upsertProfile(database, "first", FIELDS).playerNumber).toBe(1);
    expect(upsertProfile(database, "second", FIELDS).playerNumber).toBe(2);
  });

  it("keeps the player number when the profile changes", () => {
    const database = setup();
    upsertProfile(database, "first", FIELDS);
    upsertProfile(database, "second", FIELDS);

    const updated = upsertProfile(database, "first", { ...FIELDS, fullName: "Gaurav P.", plays: "left" });

    expect(updated).toMatchObject({ playerNumber: 1, fullName: "Gaurav P.", plays: "left" });
  });
});
