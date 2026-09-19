// @vitest-environment node
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";

import {
  FanRejectedError,
  addReaction,
  clearMatchFanData,
  countPredictions,
  countReactions,
  fanLeaderboard,
  getOwnPrediction,
  hideMessage,
  listCourtMessages,
  listMessagesToModerate,
  listOwnReactions,
  muteFan,
  postFanMessage,
  savePrediction,
  showMessage,
  unmuteFan,
} from "@/db/fan";
import { resetMatch } from "@/db/matches";
import * as schema from "@/db/schema";
import { SEED_TOURNAMENT } from "@/db/seed";
import { FAN_MESSAGE_INTERVAL_MS } from "@/lib/fan-chat";
import type { MatchEvent, Side } from "@/lib/match";

const TOURNAMENT_ID = "tournament-1";
const DRAW_ID = "draw-ms";
const MATCH_ID = "match-1";
const COURT = 1;
const NOW = 1_700_000_000_000;
const ADMIN = "admin@example.com";
const POINTS_PER_GAME = 4;
const RHEA = { userId: "rhea", email: "rhea@example.com" };
const ARJUN = { userId: "arjun", email: "arjun@example.com" };

/** Events where `side` wins `games` games in a row. */
function gamesWonBy(side: Side, games: number): MatchEvent[] {
  return Array.from({ length: games * POINTS_PER_GAME }, () => ({ type: "point", side }) as const);
}

type Db = ReturnType<typeof drizzle<typeof schema>>;

/** A tournament with one match in progress, and two fans with accounts. */
function setup(events: readonly MatchEvent[]): Db {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const database = drizzle(sqlite, { schema });
  migrate(database, { migrationsFolder: "./drizzle" });
  database.insert(schema.tournaments).values({ id: TOURNAMENT_ID, ...SEED_TOURNAMENT }).run();

  database.insert(schema.users).values({ id: RHEA.userId, email: RHEA.email, name: "Rhea Account" }).run();
  database
    .insert(schema.profiles)
    .values({
      userId: RHEA.userId,
      fullName: "Rhea Sharma",
      dateOfBirth: "1998-01-01",
      gender: "female",
      mobile: "1",
    })
    .run();
  // A fan who signed in without making a player profile.
  database.insert(schema.users).values({ id: ARJUN.userId, email: ARJUN.email, name: "Arjun Kumar" }).run();

  database
    .insert(schema.draws)
    .values({ id: DRAW_ID, tournamentId: TOURNAMENT_ID, category: "OS", status: "published", size: 2 })
    .run();
  database
    .insert(schema.matches)
    .values({
      id: MATCH_ID,
      drawId: DRAW_ID,
      matchNumber: 1,
      roundIndex: 0,
      roundName: "Final",
      topSlot: { kind: "entry", entryId: "top-entry" },
      bottomSlot: { kind: "entry", entryId: "bottom-entry" },
      events: [...events],
      firstServer: "top",
      status: "in_progress",
      court: COURT,
      startedAt: NOW,
    })
    .run();
  return database;
}

const CHAT = { tournamentId: TOURNAMENT_ID, courtNumber: COURT, userId: RHEA.userId };

describe("court chat", () => {
  it("posts a message and shows a display name without the email", () => {
    const database = setup([]);

    postFanMessage(database, { ...CHAT, body: "  What a rally  ", now: NOW });

    expect(listCourtMessages(database, TOURNAMENT_ID, COURT)).toEqual([
      { id: expect.any(String), name: "Rhea S.", body: "What a rally", createdAt: NOW },
    ]);
  });

  it("names a fan with no player profile from their account", () => {
    const database = setup([]);

    postFanMessage(database, { ...CHAT, userId: ARJUN.userId, body: "Come on", now: NOW });

    expect(listCourtMessages(database, TOURNAMENT_ID, COURT)[0].name).toBe("Arjun K.");
  });

  it("refuses a second message before the wait has passed, and allows it after", () => {
    const database = setup([]);
    postFanMessage(database, { ...CHAT, body: "First", now: NOW });

    expect(() => postFanMessage(database, { ...CHAT, body: "Second", now: NOW + 1 })).toThrow(
      FanRejectedError,
    );
    postFanMessage(database, { ...CHAT, body: "Second", now: NOW + FAN_MESSAGE_INTERVAL_MS });

    expect(listCourtMessages(database, TOURNAMENT_ID, COURT).map((message) => message.body)).toEqual([
      "First",
      "Second",
    ]);
  });

  it("refuses blocked language and a muted fan, and lets a mute be lifted", () => {
    const database = setup([]);

    expect(() => postFanMessage(database, { ...CHAT, body: "you bastard", now: NOW })).toThrow(
      FanRejectedError,
    );

    muteFan(database, RHEA.userId, ADMIN);
    expect(() => postFanMessage(database, { ...CHAT, body: "Hello", now: NOW })).toThrow(FanRejectedError);

    unmuteFan(database, RHEA.userId);
    postFanMessage(database, { ...CHAT, body: "Hello", now: NOW });
    expect(listCourtMessages(database, TOURNAMENT_ID, COURT)).toHaveLength(1);
  });

  it("hides a message from the chat but keeps it for admins, and can put it back", () => {
    const database = setup([]);
    postFanMessage(database, { ...CHAT, body: "Out of order", now: NOW });
    const [message] = listCourtMessages(database, TOURNAMENT_ID, COURT);

    hideMessage(database, message.id, "Admin@Example.com");

    expect(listCourtMessages(database, TOURNAMENT_ID, COURT)).toEqual([]);
    expect(listMessagesToModerate(database, TOURNAMENT_ID, 10)).toEqual([
      {
        id: message.id,
        name: "Rhea S.",
        body: "Out of order",
        createdAt: NOW,
        courtNumber: COURT,
        hiddenAt: expect.any(Number),
        userId: RHEA.userId,
        email: RHEA.email,
        muted: false,
      },
    ]);

    showMessage(database, message.id);
    expect(listCourtMessages(database, TOURNAMENT_ID, COURT)).toHaveLength(1);
  });

  it("drops a fan's messages when their account goes", () => {
    const database = setup([]);
    postFanMessage(database, { ...CHAT, body: "Hello", now: NOW });

    database.delete(schema.users).where(eq(schema.users.id, RHEA.userId)).run();

    expect(listCourtMessages(database, TOURNAMENT_ID, COURT)).toEqual([]);
  });
});

describe("reactions", () => {
  it("counts one of each kind per fan", () => {
    const database = setup([]);

    addReaction(database, MATCH_ID, RHEA.userId, "clap");
    addReaction(database, MATCH_ID, RHEA.userId, "clap");
    addReaction(database, MATCH_ID, ARJUN.userId, "clap");
    addReaction(database, MATCH_ID, RHEA.userId, "shot");

    expect(countReactions(database, MATCH_ID)).toEqual({ clap: 2, shot: 1, ball: 0 });
    expect(listOwnReactions(database, MATCH_ID, RHEA.userId).sort()).toEqual(["clap", "shot"]);
  });
});

describe("predictions", () => {
  it("saves a pick and lets a fan change it while the set is open", () => {
    const database = setup(gamesWonBy("top", 2));

    savePrediction(database, { matchId: MATCH_ID, setNumber: 1, userId: RHEA.userId, side: "top" });
    savePrediction(database, { matchId: MATCH_ID, setNumber: 1, userId: RHEA.userId, side: "bottom" });
    savePrediction(database, { matchId: MATCH_ID, setNumber: 1, userId: ARJUN.userId, side: "top" });

    expect(getOwnPrediction(database, MATCH_ID, 1, RHEA.userId)).toBe("bottom");
    expect(countPredictions(database, MATCH_ID, 1)).toEqual({ top: 1, bottom: 1 });
  });

  it("refuses a pick once the set reaches five games, and one for another set", () => {
    const open = setup(gamesWonBy("top", 4));
    savePrediction(open, { matchId: MATCH_ID, setNumber: 1, userId: RHEA.userId, side: "top" });

    expect(() =>
      savePrediction(open, { matchId: MATCH_ID, setNumber: 2, userId: RHEA.userId, side: "top" }),
    ).toThrow(FanRejectedError);

    const closed = setup(gamesWonBy("top", 5));
    expect(() =>
      savePrediction(closed, { matchId: MATCH_ID, setNumber: 1, userId: RHEA.userId, side: "top" }),
    ).toThrow(FanRejectedError);
  });

  it("gives a point for each set the fan called right, once the set is over", () => {
    const database = setup(gamesWonBy("top", 2));
    savePrediction(database, { matchId: MATCH_ID, setNumber: 1, userId: RHEA.userId, side: "top" });
    savePrediction(database, { matchId: MATCH_ID, setNumber: 1, userId: ARJUN.userId, side: "bottom" });

    expect(fanLeaderboard(database, TOURNAMENT_ID)).toEqual([]);

    // The first set finishes 6–2 to the top side.
    database
      .update(schema.matches)
      .set({ events: [...gamesWonBy("top", 6)] })
      .where(eq(schema.matches.id, MATCH_ID))
      .run();

    expect(fanLeaderboard(database, TOURNAMENT_ID)).toEqual([
      { userId: RHEA.userId, name: "Rhea S.", points: 1, correct: 1, decided: 1 },
      { userId: ARJUN.userId, name: "Arjun K.", points: 0, correct: 0, decided: 1 },
    ]);
  });

  it("scores nothing for a set nobody finished", () => {
    const database = setup(gamesWonBy("top", 2));
    savePrediction(database, { matchId: MATCH_ID, setNumber: 1, userId: RHEA.userId, side: "top" });

    database
      .update(schema.matches)
      .set({ status: "completed", completedAt: NOW })
      .where(eq(schema.matches.id, MATCH_ID))
      .run();

    expect(fanLeaderboard(database, TOURNAMENT_ID)).toEqual([]);
  });
});

describe("clearMatchFanData", () => {
  it("drops picks and reactions when a match is reset", () => {
    const database = setup(gamesWonBy("top", 2));
    savePrediction(database, { matchId: MATCH_ID, setNumber: 1, userId: RHEA.userId, side: "top" });
    addReaction(database, MATCH_ID, RHEA.userId, "clap");

    resetMatch(database, MATCH_ID);

    expect(countPredictions(database, MATCH_ID, 1)).toEqual({ top: 0, bottom: 0 });
    expect(countReactions(database, MATCH_ID)).toEqual({ clap: 0, shot: 0, ball: 0 });
  });

  it("clears one match only", () => {
    const database = setup(gamesWonBy("top", 2));
    savePrediction(database, { matchId: MATCH_ID, setNumber: 1, userId: RHEA.userId, side: "top" });

    clearMatchFanData(database, "another-match");

    expect(countPredictions(database, MATCH_ID, 1)).toEqual({ top: 1, bottom: 0 });
  });
});
