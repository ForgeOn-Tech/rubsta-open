import Link from "next/link";

import { requireAdmin } from "@/auth/require";
import { AdminNotice } from "@/components/admin-notice";
import { AdminPageHeader } from "@/components/admin-page-header";
import { DrawStatusBadge } from "@/components/draw-status-badge";
import { getDb } from "@/db/client";
import { listDrawsWithSlots } from "@/db/draws";
import { getCurrentTournament, listTournamentEntries } from "@/db/queries";
import { CATEGORIES } from "@/db/schema";
import {
  ADMIN_DRAWS_PATH,
  canDraw,
  drawChanges,
  drawSize,
  eligibleRows,
  hasDrawChanges,
  toDrawEntrant,
} from "@/lib/draws";
import { CATEGORY_LABELS } from "@/lib/entries";

export const dynamic = "force-dynamic";

const COLUMNS = ["Event", "Accepted", "Draw", "Seeds", "Status"] as const;

export default async function AdminDrawsPage() {
  await requireAdmin();

  const tournament = getCurrentTournament();
  if (!tournament) return <AdminNotice message="No tournament has been set up." />;

  const rows = listTournamentEntries(tournament.id);
  const drawsByCategory = new Map(
    listDrawsWithSlots(getDb(), tournament.id).map((item) => [item.draw.category, item]),
  );
  const events = CATEGORIES.map((category) => {
    const entrants = eligibleRows(rows, category).map(toDrawEntrant);
    const existing = drawsByCategory.get(category) ?? null;
    return {
      category,
      accepted: entrants.length,
      seeds: entrants.filter((entrant) => entrant.seed !== null).length,
      size: canDraw(entrants.length) ? drawSize(entrants.length) : null,
      status: existing?.draw.status ?? null,
      outOfDate: existing ? hasDrawChanges(drawChanges(existing.slots, entrants)) : false,
    };
  });

  return (
    <>
      <AdminPageHeader
        eyebrow={`${tournament.name} · Draws`}
        title="Draws"
        stats={[
          `${events.filter((event) => event.status === "published").length} published`,
          `${events.filter((event) => event.status === "draft").length} draft`,
        ]}
      />

      <div className="flex flex-col gap-3 p-6">
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
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
              {events.map((event) => (
                <tr key={event.category} className="border-b border-line last:border-b-0">
                  <th scope="row" className="px-4 py-3 text-left font-medium">
                    <Link href={`${ADMIN_DRAWS_PATH}/${event.category}`}>
                      {CATEGORY_LABELS[event.category]}
                    </Link>
                  </th>
                  <td className="mono px-4 py-3">{event.accepted}</td>
                  <td className="mono px-4 py-3">
                    {event.size === null ? (
                      <span className="text-dim">Needs 2</span>
                    ) : (
                      `${event.size} lines`
                    )}
                  </td>
                  <td className="mono px-4 py-3">{event.seeds}</td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap items-center gap-2">
                      <DrawStatusBadge status={event.status} />
                      {event.outOfDate ? (
                        <span className="text-[12px] text-warn">Out of date</span>
                      ) : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-dim">
          Draws include confirmed and paid entries. A draw is out of date when entries or seeds
          changed after it was made.
        </p>
      </div>
    </>
  );
}
