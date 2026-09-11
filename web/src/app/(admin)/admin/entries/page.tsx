import { desc, eq } from "drizzle-orm";
import Link from "next/link";

import { requireAdmin } from "@/auth/require";
import { AdminPageHeader } from "@/components/admin-page-header";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/db/client";
import {
  ENTRY_STATUS_LABELS,
  entries,
  profiles,
  tournaments,
  users,
} from "@/db/schema";
import { ageFromDob } from "@/lib/age";
import {
  CATEGORY_LABELS,
  STATUS_ORDER,
  countByStatus,
  parseStatusFilter,
} from "@/lib/entries";
import { formatEntryCloses, formatEntryTime, formatFee } from "@/lib/format";

export const dynamic = "force-dynamic";

const ENTRIES_PATH = "/admin/entries";
const EMPTY_CELL = "—";
const COLUMNS = [
  "Player",
  "Event",
  "Partner",
  "Age",
  "Mobile",
  "Club",
  "Status",
  "Submitted",
] as const;

export default async function AdminEntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const { status } = await searchParams;
  const filter = parseStatusFilter(status);

  const tournament = db.select().from(tournaments).get();
  if (!tournament) {
    return (
      <div className="p-6">
        <p className="card p-4 text-[13px] text-muted" role="status">
          No tournament has been set up.
        </p>
      </div>
    );
  }

  const rows = db
    .select({
      entry: entries,
      email: users.email,
      accountName: users.name,
      profile: profiles,
    })
    .from(entries)
    .innerJoin(users, eq(entries.userId, users.id))
    .leftJoin(profiles, eq(profiles.userId, entries.userId))
    .where(eq(entries.tournamentId, tournament.id))
    .orderBy(desc(entries.createdAt))
    .all();

  const counts = countByStatus(rows.map((row) => row.entry.status));
  const visibleRows = filter
    ? rows.filter((row) => row.entry.status === filter)
    : rows;

  return (
    <>
      <AdminPageHeader
        eyebrow={`${tournament.name} · Entries`}
        title="Entries"
        stats={[
          `${rows.length} entries`,
          `Fee ${formatFee(tournament.feeCents, tournament.currency)}`,
          `Closes ${formatEntryCloses(tournament.entryClosesAt)} IST`,
        ]}
      />

      <div className="flex flex-col gap-5 p-6">
        <nav
          aria-label="Filter by status"
          className="flex w-fit max-w-full flex-wrap border border-line bg-surface-1"
        >
          <FilterLink
            href={ENTRIES_PATH}
            label="All"
            count={rows.length}
            active={filter === null}
          />
          {STATUS_ORDER.map((value) => (
            <FilterLink
              key={value}
              href={`${ENTRIES_PATH}?status=${value}`}
              label={ENTRY_STATUS_LABELS[value]}
              count={counts[value]}
              active={filter === value}
            />
          ))}
        </nav>

        <div className="card overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left text-[13px]">
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
              {visibleRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={COLUMNS.length}
                    className="px-4 py-8 text-center text-muted"
                  >
                    {filter
                      ? `No ${ENTRY_STATUS_LABELS[filter].toLowerCase()} entries.`
                      : "No entries yet."}
                  </td>
                </tr>
              ) : (
                visibleRows.map(({ entry, email, accountName, profile }) => {
                  const age = profile ? ageFromDob(profile.dateOfBirth) : null;
                  return (
                    <tr
                      key={entry.id}
                      className="border-b border-line align-top last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {profile?.fullName ?? accountName ?? email}
                        </div>
                        <div className="mono mt-0.5 text-[11px] text-dim">{email}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {CATEGORY_LABELS[entry.category]}
                      </td>
                      <td className="px-4 py-3">
                        {entry.partnerName ? (
                          <>
                            <div>{entry.partnerName}</div>
                            <div className="mono mt-0.5 text-[11px] text-dim">
                              {entry.partnerEmail}
                            </div>
                          </>
                        ) : (
                          EMPTY_CELL
                        )}
                      </td>
                      <td className="mono px-4 py-3">{age ?? EMPTY_CELL}</td>
                      <td className="mono whitespace-nowrap px-4 py-3">
                        {profile?.mobile ?? EMPTY_CELL}
                      </td>
                      <td className="px-4 py-3">{profile?.club ?? EMPTY_CELL}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={entry.status} />
                      </td>
                      <td className="mono whitespace-nowrap px-4 py-3 text-[12px] text-muted">
                        {formatEntryTime(entry.createdAt)}
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

function FilterLink({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex h-8 items-center gap-2 border-r border-line px-3.5 text-[12px] last:border-r-0 ${
        active ? "bg-surface-2 font-semibold" : ""
      }`}
    >
      <span className={active ? "text-ink" : "text-muted"}>{label}</span>
      <span className="mono text-[11px] text-dim">{count}</span>
    </Link>
  );
}
