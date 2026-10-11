// @vitest-environment node
import SQLite from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { expect, it } from "vitest";
import { approveAvatarShare, deleteAvatar, finishAvatar, reserveAvatar, revokeAvatarShare } from "../avatars";
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

it("ties publication consent to the exact avatar and clears it on replacement or deletion", () => {
  const { db, sqlite } = setup();
  try {
    finishAvatar(db, "player", reserveAvatar(db, "player"), "first-avatar");
    const version = db.select().from(schema.playerAvatars).get()!.updatedAt;
    expect(() => approveAvatarShare(db, "player", version - 1, "card")).toThrow("changed");
    approveAvatarShare(db, "player", version, "approved-card");
    expect(db.select().from(schema.avatarShares).get()?.png).toBe("approved-card");
    revokeAvatarShare(db, "player");
    expect(db.select().from(schema.avatarShares).get()).toBeUndefined();
    approveAvatarShare(db, "player", version, "approved-card");
    finishAvatar(db, "player", reserveAvatar(db, "player"), "second-avatar");
    expect(db.select().from(schema.avatarShares).get()).toBeUndefined();
    const nextVersion = db.select().from(schema.playerAvatars).get()!.updatedAt;
    approveAvatarShare(db, "player", nextVersion, "new-card");
    deleteAvatar(db, "player");
    expect(db.select().from(schema.avatarShares).get()).toBeUndefined();
  } finally { sqlite.close(); }
});
