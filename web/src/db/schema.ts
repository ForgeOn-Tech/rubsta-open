import type { AdapterAccountType } from "next-auth/adapters";
import { sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import type { MatchEvent, Side } from "@/lib/match";

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
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

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
    partnerEmail: text("partner_email"),
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
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [uniqueIndex("matches_draw_number").on(table.drawId, table.matchNumber)],
);

export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Tournament = typeof tournaments.$inferSelect;
export type Entry = typeof entries.$inferSelect;
export type Draw = typeof draws.$inferSelect;
export type DrawSlot = typeof drawSlots.$inferSelect;
export type Match = typeof matches.$inferSelect;
