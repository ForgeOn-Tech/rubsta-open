import Link from "next/link";

import { requireAdmin } from "@/auth/require";
import { AdminNotice } from "@/components/admin-notice";
import { AdminPageHeader } from "@/components/admin-page-header";
import { StatusBadge } from "@/components/status-badge";
import { getCurrentTournament, listEntrySummaries, listPlayerAccounts } from "@/db/queries";
import { ADMIN_ENTRIES_PATH, playerName } from "@/lib/admin-entries";
import { ageFromDob } from "@/lib/age";
import { CATEGORY_LABELS } from "@/lib/entries";
import { countLabel } from "@/lib/format";
import {
  ADMIN_PLAYERS_PATH,
  buildPlayerRows,
  matchesPlayerSearch,
  parseSearchQuery,
} from "@/lib/players";

export const dynamic = "force-dynamic";

const EMPTY_CELL = "—";
const COLUMNS = ["Player", "Mobile", "Club", "Age", "Best ranking", "Entries"] as const;

export default async function AdminPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const { q } = await searchParams;
  const query = parseSearchQuery(q);

  const tournament = getCurrentTournament();
  if (!tournament) return <AdminNotice message="No tournament has been set up." />;

  const players = buildPlayerRows(listPlayerAccounts(), listEntrySummaries(tournament.id));
  const visible = players.filter((row) => matchesPlayerSearch(row, query));
  const withEntries = players.filter((row) => row.entries.length > 0).length;

  return (
    <>
      <AdminPageHeader
        eyebrow={`${tournament.name} · Players`}
        title="Players"
        stats={[countLabel(players.length, "player", "players"), `${withEntries} with entries`]}
      />

      <div className="flex flex-col gap-4 p-6">
        <form role="search" action={ADMIN_PLAYERS_PATH} className="flex max-w-xl gap-2">
          <label htmlFor="player-search" className="sr-only">
            Search players
          </label>
          <input
            id="player-search"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Name, email, club or mobile"
            className="field mt-0 h-10"
          />
          <button type="submit" className="btn btn-outline h-10">
            Search
          </button>
        </form>

        {query ? (
          <p className="text-[12px] text-muted" role="status">
            {visible.length} of {players.length} players match &ldquo;{query}&rdquo;.{" "}
            <Link href={ADMIN_PLAYERS_PATH}>Clear search</Link>
          </p>
        ) : null}

        <div className="card overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-line">
                {COLUMNS.map((column) => (
                  <th key={column} scope="col" className="thead px-4 py-3 font-normal">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-muted">
                    {query ? `No players match “${query}”.` : "No players yet."}
                  </td>
                </tr>
              ) : (
                visible.map(({ account, entries }) => {
                  const { profile } = account;
                  const age = profile ? ageFromDob(profile.dateOfBirth) : null;
                  return (
                    <tr
                      key={account.userId}
                      className="border-b border-line align-top last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{playerName(account)}</div>
                        <div className="mono mt-0.5 text-[11px] text-dim">{account.email}</div>
                        {profile ? null : (
                          <div className="mt-0.5 text-[11px] text-warn">No profile saved</div>
                        )}
                      </td>
                      <td className="mono whitespace-nowrap px-4 py-3">
                        {profile?.mobile ?? EMPTY_CELL}
                      </td>
                      <td className="px-4 py-3">{profile?.club ?? EMPTY_CELL}</td>
                      <td className="mono px-4 py-3">{age ?? EMPTY_CELL}</td>
                      <td className="px-4 py-3">{profile?.bestRanking ?? EMPTY_CELL}</td>
                      <td className="px-4 py-2.5">
                        {entries.length === 0 ? (
                          <span className="text-muted">No entries</span>
                        ) : (
                          <ul className="flex flex-col gap-1.5">
                            {entries.map((entry) => (
                              <li key={entry.id} className="flex items-center gap-2">
                                <Link href={`${ADMIN_ENTRIES_PATH}/${entry.id}`}>
                                  {CATEGORY_LABELS[entry.category]}
                                </Link>
                                <StatusBadge status={entry.status} />
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
