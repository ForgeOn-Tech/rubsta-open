import type { Category, EntryStatus, Profile } from "@/db/schema";
import { playerName } from "@/lib/admin-entries";

export const ADMIN_PLAYERS_PATH = "/admin/players";

const MAX_SEARCH_LENGTH = 100;

/** A user account with its profile, if the player has saved one. */
export interface PlayerAccount {
  userId: string;
  email: string;
  accountName: string | null;
  profile: Profile | null;
}

export interface PlayerEntrySummary {
  id: string;
  userId: string;
  category: Category;
  status: EntryStatus;
}

export interface AdminPlayerRow {
  account: PlayerAccount;
  entries: PlayerEntrySummary[];
}

/**
 * Accounts with a profile or at least one entry, each with its entries,
 * sorted by player name. Accounts with neither (e.g. an admin who only
 * signed in) are left out. A doubles partner appears through their own
 * account; the entries they joined as a partner are not listed under it.
 */
export function buildPlayerRows(
  accounts: readonly PlayerAccount[],
  entries: readonly PlayerEntrySummary[],
): AdminPlayerRow[] {
  return accounts
    .map((account) => ({
      account,
      entries: entries.filter((entry) => entry.userId === account.userId),
    }))
    .filter((row) => row.account.profile !== null || row.entries.length > 0)
    .sort((a, b) => playerName(a.account).localeCompare(playerName(b.account)));
}

/** The ?q= search, trimmed and capped. */
export function parseSearchQuery(value: string | undefined): string {
  return (value ?? "").trim().slice(0, MAX_SEARCH_LENGTH);
}

/** Case-insensitive match on name, email, club or mobile. An empty query matches everyone. */
export function matchesPlayerSearch(row: AdminPlayerRow, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const { account } = row;
  return [
    account.profile?.fullName,
    account.accountName,
    account.email,
    account.profile?.club,
    account.profile?.mobile,
  ].some((value) => value?.toLowerCase().includes(needle));
}
