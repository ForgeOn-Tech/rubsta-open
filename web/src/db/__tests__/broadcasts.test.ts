// @vitest-environment node
import SQLite from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeEach, afterEach, expect, it } from "vitest";
import * as schema from "../schema";
import { SEED_TOURNAMENT } from "../seed";
import { addCourt, deleteCourt, updateCourt } from "../courts";
import { getBroadcast, saveBroadcast } from "../broadcasts";
import { fanFeed } from "../fan-feed";
import { publicBroadcast, validateBroadcast } from "@/lib/broadcast";
let sqlite: SQLite.Database;
let db: ReturnType<typeof drizzle<typeof schema>>;
const streamUrl = "https://www.youtube.com/live/abcdefghijk?secret=discard-this";
const replayUrl = "https://youtu.be/12345678901";
beforeEach(() => {
  sqlite = new SQLite(":memory:"); sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema }); migrate(db, { migrationsFolder: "./drizzle" });
  db.insert(schema.tournaments).values({ id: "t", ...SEED_TOURNAMENT }).run();
  addCourt(db, "t", { name: "Centre", surface: "Hard", streamUrl: null });
});
afterEach(() => sqlite.close());
it("preserves existing court links as starting soon, not falsely live", () => {
  updateCourt(db, "t", 1, { name: "Centre", surface: "Hard", streamUrl });
  expect(getBroadcast(db, "t", 1)).toMatchObject({ status: "scheduled", streamUrl });
  expect(getBroadcast(db, "other", 1)).toBeNull();
});
it("saves broadcast status separately from matches and updates the public feed", () => {
  saveBroadcast(db, "t", 1, { status: "live", streamUrl, replayUrl: "" });
  const feed = fanFeed(db, { tournamentId: "t", courtNumber: 1, userId: null, watching: 0 });
  expect(feed.live).toBeNull();
  expect(feed.broadcast).toEqual({ status: "live", embedUrl: "https://www.youtube.com/embed/abcdefghijk", watchUrl: "https://www.youtube.com/watch?v=abcdefghijk", replay: false });
  expect(JSON.stringify(feed)).not.toContain("secret");
});
it("rejects invalid links or courts without changing the saved broadcast", () => {
  saveBroadcast(db, "t", 1, { status: "scheduled", streamUrl, replayUrl: "" });
  const before = getBroadcast(db, "t", 1);
  for (const value of ["https://evil.example/video", "javascript:alert(1)", "https://youtube.com.evil.example/watch?v=abcdefghijk", "rtmp://youtube.com/secret-key"]) {
    expect(() => saveBroadcast(db, "t", 1, { status: "live", streamUrl: value, replayUrl: "" })).toThrow("YouTube");
  }
  expect(() => saveBroadcast(db, "t", 1, { status: "live", streamUrl: "", replayUrl: "" })).toThrow("Add a YouTube");
  expect(() => saveBroadcast(db, "other", 1, { status: "off", streamUrl: "", replayUrl: "" })).toThrow("current tournament");
  expect(() => validateBroadcast({ status: "invented", streamUrl, replayUrl: "" })).toThrow("status");
  expect(getBroadcast(db, "t", 1)).toEqual(before);
});
it("shows only an explicitly saved replay after ending and hides everything when off", () => {
  saveBroadcast(db, "t", 1, { status: "ended", streamUrl, replayUrl: "" });
  expect(publicBroadcast(getBroadcast(db, "t", 1)!)).toMatchObject({ embedUrl: null, replay: false });
  saveBroadcast(db, "t", 1, { status: "ended", streamUrl, replayUrl });
  expect(publicBroadcast(getBroadcast(db, "t", 1)!)).toMatchObject({ embedUrl: "https://www.youtube.com/embed/12345678901", replay: true });
  saveBroadcast(db, "t", 1, { status: "off", streamUrl, replayUrl });
  expect(publicBroadcast(getBroadcast(db, "t", 1)!)).toEqual({ status: "off", embedUrl: null, watchUrl: null, replay: false });
});
it("resets status and replay if the old Settings form changes the video", () => {
  saveBroadcast(db, "t", 1, { status: "live", streamUrl, replayUrl });
  updateCourt(db, "t", 1, { name: "Centre", surface: "Hard", streamUrl: replayUrl });
  expect(getBroadcast(db, "t", 1)).toEqual({ status: "scheduled", streamUrl: replayUrl, replayUrl: null });
  updateCourt(db, "t", 1, { name: "Centre", surface: "Hard", streamUrl: null });
  expect(getBroadcast(db, "t", 1)?.status).toBe("off");
});
it("deletes court broadcast settings when an unused court is removed", () => {
  saveBroadcast(db, "t", 1, { status: "off", streamUrl: "", replayUrl: "" });
  deleteCourt(db, "t", 1);
  expect(db.select().from(schema.courtBroadcasts).all()).toEqual([]);
});

it("renders old Settings links with long tracking queries without failing the public feed", () => {
  updateCourt(db, "t", 1, { name: "Centre", surface: "Hard", streamUrl: streamUrl + "x".repeat(3000) });
  expect(publicBroadcast(getBroadcast(db, "t", 1)!)).toMatchObject({ watchUrl: "https://www.youtube.com/watch?v=abcdefghijk" });
});
