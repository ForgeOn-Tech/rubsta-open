import type { AdapterAccountType } from "next-auth/adapters";
import { sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

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
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [uniqueIndex("entries_user_category").on(table.userId, table.category)],
);

export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Tournament = typeof tournaments.$inferSelect;
export type Entry = typeof entries.$inferSelect;
