import Link from "next/link";
import { notFound } from "next/navigation";

import { changeDrawStatus, decideGroupPlaceAction, generateDrawAction, saveDrawSeeds } from "../actions";
import { Bracket } from "../bracket";
import { DrawActions } from "../draw-actions";
import { GroupsSection, type GroupCard } from "../groups-section";
import { SeedsForm } from "../seeds-form";
import { requireAdmin } from "@/auth/require";
import { AdminNotice } from "@/components/admin-notice";
import { AdminPageHeader } from "@/components/admin-page-header";
import { getDb } from "@/db/client";
import { getDrawWithSlots, type DrawWithSlots } from "@/db/draws";
import { chosenPlan, listGroups, planOfDraw } from "@/db/groups";
import { listScoringMatches, type ScoringMatchRow } from "@/db/matches";
import { getCurrentTournament, listTournamentEntries } from "@/db/queries";
import { DRAW_STATUS_LABELS, type Category, type MatchSlot } from "@/db/schema";
import { entrantLabel, parseCategoryFilter } from "@/lib/admin-entries";
import {
  ADMIN_DRAWS_PATH,
  MAX_DRAW_SIZE,
  MIN_DRAW_ENTRANTS,
  buildBracket,
  buildBracketFromSlots,
  canDraw,
  describeDrawChanges,
  drawChanges,
  drawSize,
  eligibleRows,
  hasDrawChanges,
  toDrawEntrant,
  type BracketRound,
  type BracketSlot,
} from "@/lib/draws";
import { groupPlan, groupPlanLabel, knockoutSlots, seedLimit } from "@/lib/groups";
import { CATEGORY_LABELS } from "@/lib/entries";
import { countLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

function bracketSlotOf(slot: MatchSlot, seed: number | null): BracketSlot {
  return slot.kind === "entry" ? { kind: "entry", entryId: slot.entryId, seed } : slot;
}

/** A published knockout as it stands, with group places filled in as they are decided. */
function knockoutFromMatches(rows: readonly ScoringMatchRow[]): BracketRound[] {
  const knockout = rows.filter((row) => row.match.groupNumber === null);
  const roundIndexes = [...new Set(knockout.map((row) => row.match.roundIndex))].sort((a, b) => a - b);
  return roundIndexes.map((roundIndex) => {
    const inRound = knockout
      .filter((row) => row.match.roundIndex === roundIndex)
      .sort((a, b) => a.match.matchNumber - b.match.matchNumber);
    return {
      name: inRound[0].match.roundName,
      matches: inRound.map((row) => ({
        number: row.match.matchNumber,
        top: bracketSlotOf(row.match.topSlot, row.top?.seed ?? null),
        bottom: bracketSlotOf(row.match.bottomSlot, row.bottom?.seed ?? null),
      })),
    };
  });
}

/** Each group of a group draw: from the draw's lines, with the table once published. */
function groupCards(
  existing: DrawWithSlots,
  labels: ReadonlyMap<string, string>,
  published: boolean,
): GroupCard[] {
  const views = published ? listGroups(getDb(), existing.draw) : [];
  const numbers = [...new Set(existing.slots.flatMap((slot) => (slot.groupNumber === null ? [] : [slot.groupNumber])))].sort((a, b) => a - b);
  return numbers.map((groupNumber) => {
    const view = views.find((each) => each.groupNumber === groupNumber) ?? null;
    return {
      groupNumber,
      members: existing.slots
        .filter((slot) => slot.groupNumber === groupNumber && slot.entryId !== null)
        .sort((a, b) => a.position - b.position)
        .map((slot) => {
          const entryId = slot.entryId as string;
          const label = labels.get(entryId);
          if (label === undefined) throw new Error(`The draw refers to unknown entry ${entryId}.`);
          return { entryId, label, seed: slot.seed };
        }),
      standings: view?.standings ?? null,
      through: view?.through ?? [],
    };
  });
}

/** The draw section: groups and a knockout for a group draw, else the bracket. */
function DrawSection({
  category,
  existing,
  labels,
  published,
  tournamentId,
}: {
  category: Category;
  existing: DrawWithSlots;
  labels: ReadonlyMap<string, string>;
  published: boolean;
  tournamentId: string;
}) {
  const groups = groupCards(existing, labels, published);
  if (groups.length === 0) {
    return (
      <section aria-labelledby="draw-heading">
        <h2 id="draw-heading" className="thead">
          Draw
        </h2>
        <div className="mt-2">
          <Bracket rounds={buildBracket(existing.slots)} labels={labels} />
        </div>
      </section>
    );
  }
  const groupMatchCount = groups.reduce((total, group) => total + (group.members.length * (group.members.length - 1)) / 2, 0);
  const knockout = published
    ? knockoutFromMatches(listScoringMatches(getDb(), tournamentId).filter((row) => row.category === category))
    : buildBracketFromSlots(knockoutSlots(planOfDraw(existing.draw, groups.length)), groupMatchCount + 1);
  return (
    <>
      <GroupsSection drawId={existing.draw.id} groups={groups} decideAction={decideGroupPlaceAction} />
      <section aria-labelledby="knockout-heading">
        <h2 id="knockout-heading" className="thead">
          Knockout
        </h2>
        <div className="mt-2">
          <Bracket rounds={knockout} labels={labels} />
        </div>
      </section>
    </>
  );
}

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
  // A draft keeps the admin's choice of groups; otherwise the plan starts from the suggestion.
  const plan = (existing === null ? null : chosenPlan(existing)) ?? groupPlan(category, entrants.length);
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
    size === null ? `Needs ${MIN_DRAW_ENTRANTS} accepted` : plan !== null ? groupPlanLabel(plan) : `${size}-line draw`,
    countLabel(entrants.filter((entrant) => entrant.seed !== null).length, "seed", "seeds"),
    size === null || plan !== null ? null : countLabel(size - entrants.length, "bye", "byes"),
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
          groupPlan={groupPlan(category, entrants.length) === null ? null : plan}
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
            maxSeeds={seedLimit(category, entrants.length)}
            locked={published}
            action={saveDrawSeeds}
          />
        )}

        {existing ? (
          <DrawSection
            category={category}
            existing={existing}
            labels={labels}
            published={published}
            tournamentId={tournament.id}
          />
        ) : null}
      </div>
    </>
  );
}
