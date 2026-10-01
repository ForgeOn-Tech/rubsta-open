import type { AdapterAccountType } from "next-auth/adapters";
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import type { MatchEvent, Side } from "@/lib/match";
import type { ScheduleEntry } from "@/lib/schedule";

// ── Auth.js adapter tables (shape per @auth/drizzle-adapter docs) ─────────

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "timestamp_ms" }),
  image: text("image"),
});

export const accounts = sqliteTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = sqliteTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (verificationToken) => [
    primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  ],
);

// ── Tournament OS tables ──────────────────────────────────────────────────

export interface PreviousTournament {
  name: string;
  year: number;
  result: string;
}

export const GENDERS = ["male", "female", "other"] as const;
export type Gender = (typeof GENDERS)[number];
export const GENDER_LABELS: Record<Gender, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
};

export const HANDS = ["right", "left"] as const;
export type Hand = (typeof HANDS)[number];
export const HAND_LABELS: Record<Hand, string> = {
  right: "Right-handed",
  left: "Left-handed",
};

export const profiles = sqliteTable("profiles", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(), // YYYY-MM-DD (ISO)
  gender: text("gender", { enum: GENDERS }).notNull(),
  mobile: text("mobile").notNull(),
  club: text("club"),
  bestRanking: text("best_ranking"),
  previousTournaments: text("previous_tournaments", { mode: "json" })
    .$type<PreviousTournament[]>()
    .notNull()
    .default([]),
  plays: text("plays", { enum: HANDS }),
  // The player ID number, e.g. 117 in FL-2026-0117. Given once, in the order profiles are made.
  playerNumber: integer("player_number"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
}, (table) => [uniqueIndex("profiles_player_number").on(table.playerNumber)]);

export const TOURNAMENT_STATUSES = ["open", "closed"] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

export const tournaments = sqliteTable("tournaments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  entryClosesAt: text("entry_closes_at").notNull(), // ISO 8601 with offset
  feeCents: integer("fee_cents").notNull(),
  currency: text("currency").notNull().default("INR"),
  status: text("status", { enum: TOURNAMENT_STATUSES })
    .notNull()
    .default("open"),
  startsOn: text("starts_on"), // YYYY-MM-DD
  endsOn: text("ends_on"), // YYYY-MM-DD
  venue: text("venue"),
  // False until an organiser confirms dates, venue and fee in /admin/settings.
  scheduleConfirmed: integer("schedule_confirmed", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const CATEGORIES = ["MS", "WS", "MD", "WD"] as const;
export type Category = (typeof CATEGORIES)[number];
export const CATEGORY_LABELS: Record<Category, string> = {
  MS: "Men's singles",
  WS: "Women's singles",
  MD: "Men's doubles",
  WD: "Women's doubles",
};
export const DOUBLES_CATEGORIES: readonly Category[] = ["MD", "WD"];

export const DIVISIONS = ["main"] as const;
export type Division = (typeof DIVISIONS)[number];

export const ENTRY_STATUSES = [
  "submitted",
  "confirmed",
  "paid",
  "cancelled",
] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];
export const ENTRY_STATUS_LABELS: Record<EntryStatus, string> = {
  submitted: "Submitted",
  confirmed: "Confirmed",
  paid: "Paid",
  cancelled: "Cancelled",
};

/** A doubles partner's answer to the entry. Singles entries have none. */
export const PARTNER_STATUSES = ["pending", "accepted", "declined"] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];
export const PARTNER_STATUS_LABELS: Record<PartnerStatus, string> = {
  pending: "Awaiting partner",
  accepted: "Partner confirmed",
  declined: "Partner declined",
};

export const entries = sqliteTable(
  "entries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tournamentId: text("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    category: text("category", { enum: CATEGORIES }).notNull(),
    division: text("division", { enum: DIVISIONS })
      .notNull()
      .default("main"),
    partnerName: text("partner_name"),
    partnerEmail: text("partner_email"), // lower case
    // Doubles only: the partner signs in with partnerEmail and accepts or declines.
    partnerStatus: text("partner_status", { enum: PARTNER_STATUSES }),
    partnerUserId: text("partner_user_id").references(() => users.id, { onDelete: "set null" }),
    partnerRespondedAt: integer("partner_responded_at"),
    status: text("status", { enum: ENTRY_STATUSES })
      .notNull()
      .default("submitted"),
    paymentRef: text("payment_ref"),
    // Seed in this event's draw. One entry per user and event, so one seed per draw.
    seed: integer("seed"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [uniqueIndex("entries_user_category").on(table.userId, table.category)],
);

export const DRAW_STATUSES = ["draft", "published"] as const;
export type DrawStatus = (typeof DRAW_STATUSES)[number];
export const DRAW_STATUS_LABELS: Record<DrawStatus, string> = {
  draft: "Draft",
  published: "Published",
};

export const draws = sqliteTable(
  "draws",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tournamentId: text("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    category: text("category", { enum: CATEGORIES }).notNull(),
    status: text("status", { enum: DRAW_STATUSES }).notNull().default("draft"),
    size: integer("size").notNull(),
    generatedAt: integer("generated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    publishedAt: integer("published_at"),
  },
  (table) => [uniqueIndex("draws_tournament_category").on(table.tournamentId, table.category)],
);

export const drawSlots = sqliteTable(
  "draw_slots",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    drawId: text("draw_id")
      .notNull()
      .references(() => draws.id, { onDelete: "cascade" }),
    position: integer("position").notNull(), // 1..size, top to bottom
    // Null is a bye. The app never deletes entries, so set null only follows a user deletion.
    entryId: text("entry_id").references(() => entries.id, { onDelete: "set null" }),
    seed: integer("seed"),
  },
  (table) => [uniqueIndex("draw_slots_draw_position").on(table.drawId, table.position)],
);

export const MATCH_STATUSES = ["scheduled", "in_progress", "completed"] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

/** Who fills a match slot: a drawn entry, the winner of an earlier match, or a bye. */
export type MatchSlot =
  | { kind: "entry"; entryId: string }
  | { kind: "winner"; matchNumber: number }
  | { kind: "bye" };

export const matches = sqliteTable(
  "matches",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    drawId: text("draw_id")
      .notNull()
      .references(() => draws.id, { onDelete: "cascade" }),
    matchNumber: integer("match_number").notNull(), // bracket number, shown as "M21"
    roundIndex: integer("round_index").notNull(), // 0 = first round; final has the highest
    roundName: text("round_name").notNull(), // from lib/draws roundName()
    topSlot: text("top_slot", { mode: "json" }).$type<MatchSlot>().notNull(),
    bottomSlot: text("bottom_slot", { mode: "json" }).$type<MatchSlot>().notNull(),
    events: text("events", { mode: "json" }).$type<MatchEvent[]>().notNull().default([]),
    decidingSet: text("deciding_set", { enum: ["set", "matchTiebreak"] })
      .notNull()
      .default("set"),
    firstServer: text("first_server", { enum: ["top", "bottom"] }).$type<Side>(),
    status: text("status", { enum: MATCH_STATUSES }).notNull().default("scheduled"),
    winnerEntryId: text("winner_entry_id").references(() => entries.id),
    court: integer("court"),
    startedAt: integer("started_at"),
    completedAt: integer("completed_at"),
    // Bumped by every score change; a device saves only on the version it read.
    version: integer("version").notNull().default(0),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [uniqueIndex("matches_draw_number").on(table.drawId, table.matchNumber)],
);

export const courts = sqliteTable(
  "courts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tournamentId: text("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    // Matches and umpires' phones record a court by this number, so it never changes.
    number: integer("number").notNull(),
    name: text("name"), // e.g. "Centre"
    surface: text("surface"), // e.g. "Hard"
    // A YouTube Live link shown in the Fan Zone, or null when nobody films this court.
    streamUrl: text("stream_url"),
  },
  (table) => [uniqueIndex("courts_tournament_number").on(table.tournamentId, table.number)],
);

export const SCHEDULE_ITEM_KINDS = ["match", "block"] as const;
export type ScheduleItemKind = (typeof SCHEDULE_ITEM_KINDS)[number];

/** A start time, a "not before" time, or straight after the item above it on the court. */
export const SCHEDULE_TIMINGS = ["at", "notBefore", "followOn"] as const;
export type ScheduleTiming = (typeof SCHEDULE_TIMINGS)[number];

/** The admins' working order of play. Umpires see only what publishing copied. */
export const scheduleItems = sqliteTable(
  "schedule_items",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tournamentId: text("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    day: text("day").notNull(), // YYYY-MM-DD
    courtNumber: integer("court_number").notNull(),
    position: integer("position").notNull(), // 1.. down the court's list
    kind: text("kind", { enum: SCHEDULE_ITEM_KINDS }).notNull(),
    // Moving a draw back to draft deletes its matches, and their places here with them.
    matchId: text("match_id").references(() => matches.id, { onDelete: "cascade" }),
    title: text("title"), // blocks only, e.g. "Serve Speed Challenge"
    note: text("note"), // blocks only
    timing: text("timing", { enum: SCHEDULE_TIMINGS }).notNull(),
    time: text("time"), // HH:MM at the venue; null when following on
    endTime: text("end_time"), // blocks only
    umpireEmail: text("umpire_email"), // matches only, lower case
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    // A match has one place in the order of play. SQLite allows many nulls, one per block.
    uniqueIndex("schedule_items_match").on(table.matchId),
    index("schedule_items_tournament_day").on(table.tournamentId, table.day),
  ],
);

/** What umpires see for a day: the items as they stood when an admin last published. */
export const scheduleDays = sqliteTable(
  "schedule_days",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tournamentId: text("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    day: text("day").notNull(), // YYYY-MM-DD
    publishedAt: integer("published_at").notNull(),
    items: text("items", { mode: "json" }).$type<ScheduleEntry[]>().notNull(),
  },
  (table) => [uniqueIndex("schedule_days_tournament_day").on(table.tournamentId, table.day)],
);

// ── Fan Zone ──────────────────────────────────────────────────────────────

/** What a fan can send while watching a match. One of each kind per fan. */
export const REACTION_KINDS = ["clap", "shot", "ball"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];
export const REACTION_LABELS: Record<ReactionKind, string> = {
  clap: "Applause",
  shot: "What a shot",
  ball: "Good ball",
};

/** One court's chat. A hidden message stays for the record and leaves the page. */
export const fanMessages = sqliteTable(
  "fan_messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tournamentId: text("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    courtNumber: integer("court_number").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    hiddenAt: integer("hidden_at"),
    hiddenBy: text("hidden_by"), // the admin's email, lower case
  },
  (table) => [index("fan_messages_court").on(table.tournamentId, table.courtNumber, table.createdAt)],
);

export const fanReactions = sqliteTable(
  "fan_reactions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: REACTION_KINDS }).notNull(),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [uniqueIndex("fan_reactions_match_user_kind").on(table.matchId, table.userId, table.kind)],
);

/**
 * A fan's pick for who takes one set. Points come from replaying the match
 * events, so nothing here needs updating when the score changes.
 */
export const fanPredictions = sqliteTable(
  "fan_predictions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    setNumber: integer("set_number").notNull(), // 1 for the first set
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    side: text("side", { enum: ["top", "bottom"] }).$type<Side>().notNull(),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [uniqueIndex("fan_predictions_match_set_user").on(table.matchId, table.setNumber, table.userId)],
);

/** A fan an admin stopped from posting. Their earlier messages are hidden one by one. */
export const fanMutes = sqliteTable("fan_mutes", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  mutedBy: text("muted_by").notNull(), // the admin's email, lower case
  mutedAt: integer("muted_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Tournament = typeof tournaments.$inferSelect;
export type Entry = typeof entries.$inferSelect;
export type Draw = typeof draws.$inferSelect;
export type DrawSlot = typeof drawSlots.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type Court = typeof courts.$inferSelect;
export type ScheduleItem = typeof scheduleItems.$inferSelect;
export type ScheduleDay = typeof scheduleDays.$inferSelect;
export type FanMessage = typeof fanMessages.$inferSelect;
export type FanReaction = typeof fanReactions.$inferSelect;
export type FanPrediction = typeof fanPredictions.$inferSelect;
export type FanMute = typeof fanMutes.$inferSelect;
