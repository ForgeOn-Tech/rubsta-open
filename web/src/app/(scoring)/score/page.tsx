import { ScoringLink as Link } from "@/components/scoring-link";

import { ConnectionNotice } from "./connection-notice";
import { MatchFinder } from "./match-finder";
import { signOutAction } from "@/auth/actions";
import { canAccessAdmin, requireScorer } from "@/auth/require";
import { getDb } from "@/db/client";
import { listScoringMatches, type ScoringMatchRow } from "@/db/matches";
import { getCurrentTournament } from "@/db/queries";
import { listPublishedDays } from "@/db/schedule";
import { CATEGORY_LABELS } from "@/lib/entries";
import {
  defaultScheduleDay,
  placeLabel,
  publishedPlaces,
  umpireMatchIds,
  venueDay,
  type PublishedPlace,
} from "@/lib/schedule";
import {
  SCORING_GROUP_ORDER,
  SCORING_GROUP_TITLES,
  groupScoringMatches,
  matchSummary,
  scoringGroupOf,
  sideLabel,
} from "@/lib/scoring-display";
import type { MatchCardView, MatchGroupView } from "@/lib/scoring-search";
import { isUmpireLinkEmail } from "@/lib/umpire-links";

export const dynamic = "force-dynamic";

/** Every match an umpire can pick up, grouped by where it stands. */
export default async function ScoringListPage() {
  const user = await requireScorer();
  const tournament = getCurrentTournament();
  const database = getDb();
  const rows = tournament ? listScoringMatches(database, tournament.id) : [];
  const groups = tournament ? groupScoringMatches(rows) : null;
  const shownGroups = groups ? SCORING_GROUP_ORDER.filter((group) => groups[group].length > 0) : [];

  const publishedDays = tournament ? listPublishedDays(database, tournament.id) : [];
  const places = publishedPlaces(
    publishedDays,
    new Map(rows.map((row) => [row.match.id, row.match.matchNumber])),
  );
  const rowsById = new Map(rows.map((row) => [row.match.id, row]));
  const yours = umpireMatchIds(places, user.email).flatMap((matchId) => {
    const row = rowsById.get(matchId);
    return row === undefined || row.match.status === "completed" ? [] : [row];
  });
  const scheduleDay = defaultScheduleDay(
    publishedDays.map((day) => day.day),
    venueDay(new Date().getTime()),
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <header className="border-b border-line bg-surface-1 px-5 pb-4 pt-[18px]">
        <div className="flex items-center justify-between gap-3">
          <span className="eyebrow truncate">{tournament?.name ?? "Tournament OS"} · Scoring</span>
          <nav aria-label="Account" className="flex flex-none items-center gap-4">
            {canAccessAdmin(user.email) ? (
              <Link href="/admin" className="caps">
                Admin
              </Link>
            ) : isUmpireLinkEmail(user.email) ? null : (
              <Link href="/home" className="caps">
                Home
              </Link>
            )}
            <form action={signOutAction}>
              <button
                type="submit"
                className="caps hover:text-accent-deep"
                style={{ cursor: "pointer", background: "none", border: "none", padding: 0 }}
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-3">
          <h1 className="text-[20px] font-semibold tracking-[-0.01em]">Matches</h1>
          {scheduleDay === null ? null : (
            <Link href={`/score/schedule/${scheduleDay}`} className="text-[13px] font-semibold">
              Order of play
            </Link>
          )}
        </div>
      </header>

      <main className="flex flex-col gap-6 px-5 py-5">
        <ConnectionNotice />
        {groups === null ? (
          <p className="card p-4 text-[13px] text-muted" role="status">
            No tournament has been set up.
          </p>
        ) : shownGroups.length === 0 && yours.length === 0 ? (
          <p className="card p-4 text-[13px] text-muted" role="status">
            No matches yet. They appear here once an admin publishes a draw.
          </p>
        ) : (
          <MatchFinder
            groups={[
              ...(yours.length === 0 ? [] : [groupView("yours", "Your matches", yours, places)]),
              ...shownGroups.map((group) =>
                groupView(group, SCORING_GROUP_TITLES[group], groups[group], places),
              ),
            ]}
          />
        )}
      </main>
    </div>
  );
}

function groupView(
  id: string,
  title: string,
  rows: readonly ScoringMatchRow[],
  places: ReadonlyMap<string, PublishedPlace>,
): MatchGroupView {
  return { id, title, cards: rows.map((row) => cardView(row, places.get(row.match.id) ?? null)) };
}

function cardView(row: ScoringMatchRow, place: PublishedPlace | null): MatchCardView {
  const { match } = row;
  const court = match.court ?? place?.courtNumber ?? null;
  return {
    id: match.id,
    heading: `M${match.matchNumber} · ${CATEGORY_LABELS[row.category]} · ${match.roundName}`,
    court: court === null ? "No court" : `Court ${court}`,
    top: sideLabel(row.top, match.topSlot).name,
    bottom: sideLabel(row.bottom, match.bottomSlot).name,
    summary: matchSummary(row),
    place: place !== null && match.status === "scheduled" ? placeLabel(place) : null,
    linked: scoringGroupOf(row) !== "waiting",
  };
}
