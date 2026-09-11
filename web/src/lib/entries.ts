import {
  CATEGORY_LABELS,
  DOUBLES_CATEGORIES,
  type Category,
  type EntryStatus,
  type TournamentStatus,
} from "@/db/schema";

export { CATEGORY_LABELS, DOUBLES_CATEGORIES };

const SQLITE_UNIQUE_VIOLATION = "SQLITE_CONSTRAINT_UNIQUE";

export function isDoubles(category: Category): boolean {
  return DOUBLES_CATEGORIES.includes(category);
}

export function isValidCategory(value: string): value is Category {
  return value in CATEGORY_LABELS;
}

export function entriesClosed(entryClosesAt: string, now: Date = new Date()): boolean {
  const closes = new Date(entryClosesAt);
  if (Number.isNaN(closes.getTime())) return false;
  return now.getTime() > closes.getTime();
}

/** Entries are open while the tournament is open and its deadline has not passed. */
export function entriesOpen(
  tournament: { status: TournamentStatus; entryClosesAt: string },
  now: Date = new Date(),
): boolean {
  return tournament.status === "open" && !entriesClosed(tournament.entryClosesAt, now);
}

export type EntryValidation =
  | { ok: true; category: Category }
  | { ok: false; error: string };

export interface EntryFormState {
  error: string | null;
}

/**
 * Pure entry-submission rules, unit-tested in __tests__. `existingCategories`
 * is the set of categories this user already has an entry in.
 */
export function validateEntryInput(input: {
  category: string;
  partnerName?: string | null;
  partnerEmail?: string | null;
  existingCategories: readonly string[];
  entryClosesAt: string;
  tournamentStatus: TournamentStatus;
  now?: Date;
}): EntryValidation {
  const {
    category,
    partnerName,
    partnerEmail,
    existingCategories,
    entryClosesAt,
    tournamentStatus,
  } = input;
  const now = input.now ?? new Date();

  if (!isValidCategory(category)) {
    return { ok: false, error: "Choose a valid category." };
  }
  if (!entriesOpen({ status: tournamentStatus, entryClosesAt }, now)) {
    return { ok: false, error: "Entries are closed." };
  }
  if (existingCategories.includes(category)) {
    return {
      ok: false,
      error: `You already have a ${CATEGORY_LABELS[category]} entry.`,
    };
  }
  if (isDoubles(category)) {
    if (!partnerName || !partnerName.trim()) {
      return {
        ok: false,
        error: `Partner name and email are required for ${CATEGORY_LABELS[category]}.`,
      };
    }
    if (!partnerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(partnerEmail.trim())) {
      return {
        ok: false,
        error: "Enter a valid partner email address.",
      };
    }
  }
  return { ok: true, category };
}

/** Order used by the entries table filter and header counts. */
export const STATUS_ORDER: readonly EntryStatus[] = [
  "submitted",
  "confirmed",
  "paid",
  "cancelled",
];

export type StatusCounts = Record<EntryStatus, number>;

/** Per-status totals for the organiser filter tabs. */
export function countByStatus(statuses: readonly EntryStatus[]): StatusCounts {
  const count = (status: EntryStatus): number =>
    statuses.filter((value) => value === status).length;
  return {
    submitted: count("submitted"),
    confirmed: count("confirmed"),
    paid: count("paid"),
    cancelled: count("cancelled"),
  };
}

/** Reads the ?status= filter; an unknown or missing value shows all entries. */
export function parseStatusFilter(value: string | undefined): EntryStatus | null {
  return STATUS_ORDER.find((status) => status === value) ?? null;
}

/** True when a write hit a SQLite unique index, including drizzle-wrapped errors. */
export function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if ((error as { code?: unknown }).code === SQLITE_UNIQUE_VIOLATION) return true;
  return isUniqueViolation(error.cause);
}

export interface PaymentOutcome {
  status: EntryStatus;
  paymentRef: string | null;
}

/**
 * What a new entry stores. Without payments it stays submitted; the stub
 * checkout (NEXT_PUBLIC_PAYMENTS_ENABLED=true) marks it paid without charging.
 */
export const PAYMENT_OUTCOMES = {
  disabled: { status: "submitted", paymentRef: null },
  stub: { status: "paid", paymentRef: "razorpay-stub" },
} as const satisfies Record<string, PaymentOutcome>;
