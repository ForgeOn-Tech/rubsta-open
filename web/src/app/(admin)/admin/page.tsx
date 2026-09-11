import { desc, eq } from "drizzle-orm";
import Link from "next/link";

import { requireAdmin } from "@/auth/require";
import { AdminPageHeader } from "@/components/admin-page-header";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/db/client";
import { ENTRY_STATUS_LABELS, entries, profiles, tournaments, users } from "@/db/schema";
import { CATEGORY_LABELS, STATUS_ORDER, countByStatus } from "@/lib/entries";
import { formatEntryTime, formatFee } from "@/lib/format";
import { summariseByEvent, timeToCloseLabel } from "@/lib/overview";

export const dynamic = "force-dynamic";

const RECENT_ENTRY_LIMIT = 5;

export default async function AdminOverviewPage() {
  await requireAdmin();

  const tournament = db.select().from(tournaments).get() ?? null;
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
      id: entries.id,
      category: entries.category,
      status: entries.status,
      createdAt: entries.createdAt,
      fullName: profiles.fullName,
      email: users.email,
    })
    .from(entries)
    .innerJoin(users, eq(entries.userId, users.id))
    .leftJoin(profiles, eq(profiles.userId, entries.userId))
    .where(eq(entries.tournamentId, tournament.id))
    .orderBy(desc(entries.createdAt))
    .all();

  const statusCounts = countByStatus(rows.map((row) => row.status));
  const events = summariseByEvent(rows);
  const recent = rows.slice(0, RECENT_ENTRY_LIMIT);

  return (
    <>
      <AdminPageHeader
        eyebrow={`${tournament.name} · Overview`}
        title="Overview"
        stats={[
          `${rows.length} entries`,
          timeToCloseLabel(tournament.entryClosesAt, new Date()),
          `Fee ${formatFee(tournament.feeCents, tournament.currency)}`,
        ]}
      >
        <Link href="/admin/entries" className="btn btn-outline h-8 text-[12px]">
          View entries
        </Link>
      </AdminPageHeader>

      <div className="flex flex-col gap-6 p-6">
        <section aria-labelledby="status-heading">
          <h2 id="status-heading" className="thead">
            Entries by status
          </h2>
          <ul className="mt-2 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
            {STATUS_ORDER.map((status) => (
              <li key={status} className="bg-surface-1">
                <Link
                  href={`/admin/entries?status=${status}`}
                  className="block px-4 py-4 hover:bg-surface-2"
                >
                  <span className="caps block">{ENTRY_STATUS_LABELS[status]}</span>
                  <span className="mono mt-1.5 block text-[26px] font-semibold text-ink">
                    {statusCounts[status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="events-heading">
          <h2 id="events-heading" className="thead">
            Entries by event
          </h2>
          <div className="card mt-2 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="thead px-4 py-3 font-normal">
                    Event
                  </th>
                  <th scope="col" className="thead px-4 py-3 text-right font-normal">
                    Entries
                  </th>
                  <th scope="col" className="thead px-4 py-3 text-right font-normal">
                    Awaiting review
                  </th>
                  <th scope="col" className="thead px-4 py-3 text-right font-normal">
                    Accepted
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.category} className="border-b border-line last:border-b-0">
                    <th scope="row" className="px-4 py-3 text-left font-medium">
                      {event.label}
                    </th>
                    <td className="mono px-4 py-3 text-right">{event.active}</td>
                    <td className="mono px-4 py-3 text-right">{event.awaitingReview}</td>
                    <td className="mono px-4 py-3 text-right">{event.accepted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-dim">
            Accepted counts confirmed and paid entries, which are the ones a draw includes.
          </p>
        </section>

        <section aria-labelledby="recent-heading">
          <h2 id="recent-heading" className="thead">
            Latest entries
          </h2>
          {recent.length === 0 ? (
            <p className="card mt-2 p-4 text-[13px] text-muted">No entries yet.</p>
          ) : (
            <ul className="card mt-2 divide-y divide-line">
              {recent.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium">
                      {row.fullName ?? row.email}
                    </span>
                    <span className="mono mt-0.5 block text-[11px] text-dim">
                      {CATEGORY_LABELS[row.category]} · {formatEntryTime(row.createdAt)}
                    </span>
                  </span>
                  <StatusBadge status={row.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
