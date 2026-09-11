import Link from "next/link";
import { notFound } from "next/navigation";

import { changeDrawStatus, generateDrawAction, saveDrawSeeds } from "../actions";
import { Bracket } from "../bracket";
import { DrawActions } from "../draw-actions";
import { SeedsForm } from "../seeds-form";
import { requireAdmin } from "@/auth/require";
import { AdminNotice } from "@/components/admin-notice";
import { AdminPageHeader } from "@/components/admin-page-header";
import { getDb } from "@/db/client";
import { getDrawWithSlots } from "@/db/draws";
import { getCurrentTournament, listTournamentEntries } from "@/db/queries";
import { DRAW_STATUS_LABELS } from "@/db/schema";
import { entrantLabel, parseCategoryFilter } from "@/lib/admin-entries";
import {
  ADMIN_DRAWS_PATH,
  MAX_DRAW_SIZE,
  MIN_DRAW_ENTRANTS,
  buildBracket,
  canDraw,
  describeDrawChanges,
  drawChanges,
  drawSize,
  eligibleRows,
  hasDrawChanges,
  maxSeeds,
  toDrawEntrant,
} from "@/lib/draws";
import { CATEGORY_LABELS } from "@/lib/entries";

export const dynamic = "force-dynamic";

export default async function AdminDrawPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  await requireAdmin();
  const category = parseCategoryFilter((await params).category);
  if (!category) notFound();

  const tournament = getCurrentTournament();
  if (!tournament) return <AdminNotice message="No tournament has been set up." />;

  const rows = listTournamentEntries(tournament.id);
  const accepted = eligibleRows(rows, category);
  const entrants = accepted.map(toDrawEntrant);
  const existing = getDrawWithSlots(getDb(), tournament.id, category);
  const size = canDraw(entrants.length) ? drawSize(entrants.length) : null;
  const changes = existing ? drawChanges(existing.slots, entrants) : null;
  const published = existing?.draw.status === "published";
  const labels = new Map(rows.map((row) => [row.entry.id, entrantLabel(row)]));
  const seedRows = accepted
    .map((row) => ({
      entryId: row.entry.id,
      label: entrantLabel(row),
      bestRanking: row.profile?.bestRanking ?? null,
      seed: row.entry.seed,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const stats = [
    `${entrants.length} accepted`,
    size === null ? `Needs ${MIN_DRAW_ENTRANTS} accepted` : `${size}-line draw`,
    `${entrants.filter((entrant) => entrant.seed !== null).length} seeds`,
    size === null ? null : `${size - entrants.length} byes`,
    existing ? DRAW_STATUS_LABELS[existing.draw.status] : "Not generated",
  ].filter((stat): stat is string => stat !== null);

  return (
    <>
      <AdminPageHeader
        eyebrow={`${tournament.name} · Draws`}
        title={`${CATEGORY_LABELS[category]} — Main draw`}
        stats={stats}
      >
        <DrawActions
          category={category}
          drawId={existing?.draw.id ?? null}
          status={existing?.draw.status ?? null}
          canGenerate={size !== null}
          generateAction={generateDrawAction}
          statusAction={changeDrawStatus}
        />
      </AdminPageHeader>

      <div className="flex flex-col gap-5 p-6">
        <Link href={ADMIN_DRAWS_PATH} className="caps w-fit">
          All draws
        </Link>

        {size === null ? (
          <p className="card p-4 text-[13px] text-muted" role="status">
            {entrants.length > MAX_DRAW_SIZE
              ? `This event has more than ${MAX_DRAW_SIZE} accepted entries, which is too many for one draw.`
              : `A draw needs at least ${MIN_DRAW_ENTRANTS} confirmed or paid entries. Confirm entries on the Entries page first.`}
          </p>
        ) : null}

        {changes && hasDrawChanges(changes) ? (
          <p
            className="border bg-surface-1 p-4 text-[13px]"
            style={{ borderColor: "var(--color-warn)" }}
            role="status"
          >
            {describeDrawChanges(changes)}{" "}
            {published
              ? "Move the draw back to draft and generate it again to include them."
              : "Generate the draw again to include them."}
          </p>
        ) : null}

        {size === null ? null : (
          <SeedsForm
            category={category}
            entrants={seedRows}
            maxSeeds={maxSeeds(size)}
            locked={published}
            action={saveDrawSeeds}
          />
        )}

        {existing ? (
          <section aria-labelledby="draw-heading">
            <h2 id="draw-heading" className="thead">
              Draw
            </h2>
            <div className="mt-2">
              <Bracket rounds={buildBracket(existing.slots)} labels={labels} />
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
