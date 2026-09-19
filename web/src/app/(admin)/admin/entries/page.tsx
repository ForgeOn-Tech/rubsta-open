import Link from "next/link";

import { changeEntryStatus } from "./actions";
import { EntryStatusActions } from "./entry-status-actions";
import { requireAdmin } from "@/auth/require";
import { AdminNotice } from "@/components/admin-notice";
import { AdminPageHeader } from "@/components/admin-page-header";
import { PartnerStatusBadge } from "@/components/partner-status-badge";
import { StatusBadge } from "@/components/status-badge";
import { getDb } from "@/db/client";
import { listDrawsWithSlots } from "@/db/draws";
import { getEventFees } from "@/db/fees";
import { getCurrentTournament, listTournamentEntries } from "@/db/queries";
import { CATEGORIES, ENTRY_STATUS_LABELS } from "@/db/schema";
import {
  ADMIN_ENTRIES_EXPORT_PATH,
  ADMIN_ENTRIES_PATH,
  entriesHref,
  filterEntries,
  parseCategoryFilter,
  playerName,
  type EntryFilters,
} from "@/lib/admin-entries";
import { ageFromDob } from "@/lib/age";
import { ADMIN_DRAWS_PATH } from "@/lib/draws";
import {
  CATEGORY_LABELS,
  STATUS_ORDER,
  countByStatus,
  parseStatusFilter,
} from "@/lib/entries";
import { countLabel, formatEntryCloses, formatEntryTime } from "@/lib/format";
import { feeRangeLabel } from "@/lib/fees";

export const dynamic = "force-dynamic";

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
  "Actions",
] as const;

export default async function AdminEntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const filters: EntryFilters = {
    status: parseStatusFilter(params.status),
    category: parseCategoryFilter(params.category),
  };

  const tournament = getCurrentTournament();
  if (!tournament) return <AdminNotice message="No tournament has been set up." />;

  const rows = listTournamentEntries(tournament.id);
  const inEvent = filterEntries(rows, { status: null, category: filters.category });
  const statusCounts = countByStatus(inEvent.map((row) => row.entry.status));
  const visibleRows = filterEntries(rows, filters);
  // Cancelling one of these entries leaves its published draw out of date.
  const publishedDrawEntryIds = new Set(
    listDrawsWithSlots(getDb(), tournament.id)
      .filter((item) => item.draw.status === "published")
      .flatMap((item) => item.slots.flatMap((slot) => (slot.entryId ? [slot.entryId] : []))),
  );

  return (
    <>
      <AdminPageHeader
        eyebrow={`${tournament.name} · Entries`}
        title="Entries"
        stats={[
          countLabel(rows.length, "entry", "entries"),
          `Fees ${feeRangeLabel(getEventFees(getDb(), tournament.id), tournament.currency)}`,
          `Closes ${formatEntryCloses(tournament.entryClosesAt)} IST`,
        ]}
      >
        {/* A plain link: the CSV comes from a route handler, not a page. */}
        <a
          href={entriesHref(ADMIN_ENTRIES_EXPORT_PATH, filters)}
          className="btn btn-outline h-8 text-[12px]"
        >
          Export CSV
        </a>
      </AdminPageHeader>

      <div className="flex flex-col gap-3 p-6">
        <nav aria-label="Filter by event" className={SEGMENTS}>
          <FilterLink
            href={entriesHref(ADMIN_ENTRIES_PATH, { ...filters, category: null })}
            label="All events"
            count={rows.length}
            active={filters.category === null}
          />
          {CATEGORIES.map((category) => (
            <FilterLink
              key={category}
              href={entriesHref(ADMIN_ENTRIES_PATH, { ...filters, category })}
              label={CATEGORY_LABELS[category]}
              count={rows.filter((row) => row.entry.category === category).length}
              active={filters.category === category}
            />
          ))}
        </nav>

        <nav aria-label="Filter by status" className={SEGMENTS}>
          <FilterLink
            href={entriesHref(ADMIN_ENTRIES_PATH, { ...filters, status: null })}
            label="All"
            count={inEvent.length}
            active={filters.status === null}
          />
          {STATUS_ORDER.map((status) => (
            <FilterLink
              key={status}
              href={entriesHref(ADMIN_ENTRIES_PATH, { ...filters, status })}
              label={ENTRY_STATUS_LABELS[status]}
              count={statusCounts[status]}
              active={filters.status === status}
            />
          ))}
        </nav>

        <div className="card mt-2 overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse text-left text-[13px]">
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
                  <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-muted">
                    {emptyMessage(filters)}
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => {
                  const { entry, email, profile } = row;
                  const name = playerName(row);
                  const age = profile ? ageFromDob(profile.dateOfBirth) : null;
                  return (
                    <tr key={entry.id} className="border-b border-line align-top last:border-b-0">
                      <td className="px-4 py-3">
                        <Link href={`${ADMIN_ENTRIES_PATH}/${entry.id}`} className="font-medium">
                          {name}
                        </Link>
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
                            {entry.partnerStatus === null ? null : (
                              <div className="mt-1">
                                <PartnerStatusBadge status={entry.partnerStatus} />
                              </div>
                            )}
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
                      <td className="px-4 py-2.5">
                        <EntryStatusActions
                          entryId={entry.id}
                          status={entry.status}
                          subject={`${name}, ${CATEGORY_LABELS[entry.category]}`}
                          action={changeEntryStatus}
                        />
                        {publishedDrawEntryIds.has(entry.id) ? (
                          <Link
                            href={`${ADMIN_DRAWS_PATH}/${entry.category}`}
                            className="mt-1.5 block text-[11px]"
                            style={{ color: "var(--color-warn)" }}
                          >
                            In the published draw
                          </Link>
                        ) : null}
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

const SEGMENTS = "flex w-fit max-w-full flex-wrap border border-line bg-surface-1";

function emptyMessage(filters: EntryFilters): string {
  const status = filters.status ? `${ENTRY_STATUS_LABELS[filters.status].toLowerCase()} ` : "";
  const event = filters.category ? ` in ${CATEGORY_LABELS[filters.category]}` : "";
  return status || event ? `No ${status}entries${event}.` : "No entries yet.";
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
