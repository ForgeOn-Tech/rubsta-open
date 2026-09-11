import {
  CATEGORIES,
  CATEGORY_LABELS,
  ENTRY_STATUS_LABELS,
  type Category,
  type Entry,
  type EntryStatus,
  type Profile,
} from "@/db/schema";
import type { CsvValue } from "@/lib/csv";
import { formatEntryTime } from "@/lib/format";

export const ADMIN_ENTRIES_PATH = "/admin/entries";
export const ADMIN_ENTRIES_EXPORT_PATH = "/admin/entries/export";

/** An entry joined with its player's account and profile. */
export interface AdminEntryRow {
  entry: Entry;
  email: string;
  accountName: string | null;
  profile: Profile | null;
}

export interface EntryFilters {
  status: EntryStatus | null;
  category: Category | null;
}

/** Reads the ?category= filter; an unknown or missing value shows every event. */
export function parseCategoryFilter(value: string | undefined): Category | null {
  return CATEGORIES.find((category) => category === value) ?? null;
}

export function filterEntries(
  rows: readonly AdminEntryRow[],
  filters: EntryFilters,
): AdminEntryRow[] {
  return rows.filter(
    (row) =>
      (filters.status === null || row.entry.status === filters.status) &&
      (filters.category === null || row.entry.category === filters.category),
  );
}

/** Link to `basePath` carrying the given filters, e.g. /admin/entries?category=MS&status=paid. */
export function entriesHref(basePath: string, filters: EntryFilters): string {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.status) params.set("status", filters.status);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/** Profile name, then account name, then email. */
export function playerName(row: Pick<AdminEntryRow, "email" | "accountName" | "profile">): string {
  return row.profile?.fullName ?? row.accountName ?? row.email;
}

export const ENTRY_CSV_HEADER = [
  "Entry ID",
  "Submitted (IST)",
  "Player",
  "Email",
  "Mobile",
  "Date of birth",
  "Club",
  "Best ranking",
  "Event",
  "Partner name",
  "Partner email",
  "Status",
  "Payment reference",
] as const;

/** Header row plus one row per entry, in the order given. */
export function entryCsvRows(rows: readonly AdminEntryRow[]): CsvValue[][] {
  return [
    [...ENTRY_CSV_HEADER],
    ...rows.map((row) => [
      row.entry.id,
      formatEntryTime(row.entry.createdAt),
      playerName(row),
      row.email,
      row.profile?.mobile ?? null,
      row.profile?.dateOfBirth ?? null,
      row.profile?.club ?? null,
      row.profile?.bestRanking ?? null,
      CATEGORY_LABELS[row.entry.category],
      row.entry.partnerName,
      row.entry.partnerEmail,
      ENTRY_STATUS_LABELS[row.entry.status],
      row.entry.paymentRef,
    ]),
  ];
}
