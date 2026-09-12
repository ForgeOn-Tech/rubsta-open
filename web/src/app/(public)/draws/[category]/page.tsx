import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth/auth";
import { getDb } from "@/db/client";
import { listScoringMatches, type ScoringMatchRow } from "@/db/matches";
import { listTeamEntryIds } from "@/db/partners";
import { getCurrentTournament } from "@/db/queries";
import { listPublishedDays } from "@/db/schedule";
import { CATEGORY_LABELS } from "@/db/schema";
import { parseCategoryFilter } from "@/lib/admin-entries";
import { SIDES } from "@/lib/match";
import { PLAYER_DRAWS_PATH, drawRounds, teamSide } from "@/lib/player-matches";
import { placeLabel, publishedPlaces, type PublishedPlace } from "@/lib/schedule";
import { snapshotOf } from "@/lib/score-sync";
import { matchSummary, setGamesBySide, sideLabel } from "@/lib/scoring-display";

export const dynamic = "force-dynamic";

// Height of one match box, so later rounds space out against the first round.
const MATCH_HEIGHT_PX = 104;

/** A published draw with results so far, marking the signed-in player's lines. */
export default async function DrawPage({ params }: { params: Promise<{ category: string }> }) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const category = parseCategoryFilter((await params).category);
  if (!category) notFound();

  const tournament = getCurrentTournament();
  const database = getDb();
  const rows = tournament
    ? listScoringMatches(database, tournament.id).filter((row) => row.category === category)
    : [];
  const places = tournament
    ? publishedPlaces(
        listPublishedDays(database, tournament.id),
        new Map(rows.map((row) => [row.match.id, row.match.matchNumber])),
      )
    : new Map<string, PublishedPlace>();
  // Signed-out visitors have no entries, so no line is marked as theirs.
  const team = new Set(userId === null ? [] : listTeamEntryIds(database, userId));
  const rounds = drawRounds(rows);
  const firstRoundMatches = rounds[0]?.rows.length ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href={PLAYER_DRAWS_PATH} className="text-[10px] font-medium uppercase tracking-[2px] text-club-muted">
          <span aria-hidden="true">←</span> All draws
        </Link>
        <h1 className="mt-3 font-serif text-[46px] font-normal leading-none tracking-[-1px]">
          {CATEGORY_LABELS[category]}
        </h1>
        <p className="mt-2 text-[13px] text-club-muted">Main draw · {tournament?.name ?? "Rubsta Open"}</p>
      </div>

      {rounds.length === 0 ? (
        <p className="border-t border-club-line pt-5 text-[13px] text-club-muted" role="status">
          The {CATEGORY_LABELS[category]} draw has not been published yet.
        </p>
      ) : (
        <div className="overflow-x-auto border-t border-club-line pt-6">
          <ol className="flex min-w-max gap-5">
            {rounds.map((round) => (
              <li key={round.roundIndex} className="w-[250px] flex-none">
                <h2 className="text-[10px] font-medium uppercase tracking-[2px] text-club-muted">{round.name}</h2>
                <ol
                  className="mt-3 flex flex-col justify-around gap-3"
                  style={{ minHeight: `${firstRoundMatches * MATCH_HEIGHT_PX}px` }}
                >
                  {round.rows.map((row) => (
                    <li key={row.match.id}>
                      <MatchBox row={row} team={team} place={places.get(row.match.id) ?? null} />
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function MatchBox({
  row,
  team,
  place,
}: {
  row: ScoringMatchRow;
  team: ReadonlySet<string>;
  place: PublishedPlace | null;
}) {
  const { match } = row;
  const bye = match.topSlot.kind === "bye" || match.bottomSlot.kind === "bye";
  const games = setGamesBySide(row);
  const mine = teamSide(row, team);
  const winner = snapshotOf(match).winner;
  const status = bye
    ? "Bye"
    : match.status === "in_progress"
      ? "Live"
      : match.status === "completed"
        ? (matchSummary(row) ?? "Final")
        : "To play";

  return (
    <article
      aria-label={`Match ${match.matchNumber}`}
      className={`border bg-club-cream ${mine === null ? "border-club-line" : "border-club-deep"}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-club-line px-2.5 py-1 text-[10px] uppercase tracking-[1px] text-club-muted">
        <span>M{match.matchNumber}</span>
        <span className={`truncate ${match.status === "in_progress" ? "font-semibold text-club-deep" : ""}`}>
          {status}
        </span>
      </div>
      {SIDES.map((side) => {
        const label = sideLabel(side === "top" ? row.top : row.bottom, side === "top" ? match.topSlot : match.bottomSlot);
        return (
          <div
            key={side}
            className={`flex items-center gap-2 px-2.5 py-1.5 text-[13px] ${mine === side ? "bg-club-mist" : ""}`}
          >
            <span className="w-4 flex-none text-[10px] text-club-muted lining-nums">{label.seed ?? ""}</span>
            <span className={`min-w-0 flex-1 truncate ${winner === side ? "font-semibold" : ""}`}>
              {label.name}
            </span>
            {mine === side ? (
              <span className="flex-none text-[9px] font-medium uppercase tracking-[1px] text-club-deep">You</span>
            ) : null}
            {games === null || bye ? null : (
              <span className="flex-none text-[12px] font-medium lining-nums">{games[side]}</span>
            )}
          </div>
        );
      })}
      {place !== null && match.status === "scheduled" ? (
        <p className="truncate border-t border-club-line px-2.5 py-1 text-[10px] text-club-muted" title={placeLabel(place)}>
          {placeLabel(place)}
        </p>
      ) : null}
    </article>
  );
}
