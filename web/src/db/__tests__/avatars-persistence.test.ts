// @vitest-environment node
import SQLite from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { expect, it } from "vitest";
import { deleteAvatar, finishAvatar, reserveAvatar } from "../avatars";
import * as schema from "../schema";

function setup() {
  const sqlite = new SQLite(":memory:");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./drizzle" });
  db.insert(schema.users).values({ id: "player", email: "player@example.com" }).run();
  return { db, sqlite };
}

it("serializes requests, persists art and enforces a rolling quota even after deletion", () => {
  const { db, sqlite } = setup();
  try {
    const first = reserveAvatar(db, "player");
    expect(() => reserveAvatar(db, "player")).toThrow("still being generated");
    finishAvatar(db, "player", first, "png");
    expect(db.select().from(schema.playerAvatars).get()?.png).toBe("png");
    deleteAvatar(db, "player");
    expect(db.select().from(schema.playerAvatars).get()).toBeUndefined();
    for (let i = 0; i < 2; i++) finishAvatar(db, "player", reserveAvatar(db, "player"));
    expect(() => reserveAvatar(db, "player")).toThrow("three avatar attempts");
    expect(() => reserveAvatar(db, "player", Date.now() + 86_400_001)).not.toThrow();
  } finally { sqlite.close(); }
});

it("does not restore an avatar deleted during generation", () => {
  const { db, sqlite } = setup();
  try {
    const attempt = reserveAvatar(db, "player");
    deleteAvatar(db, "player");
    finishAvatar(db, "player", attempt, "png");
    expect(db.select().from(schema.playerAvatars).get()).toBeUndefined();
  } finally { sqlite.close(); }
});
