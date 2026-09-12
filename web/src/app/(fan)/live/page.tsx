import Link from "next/link";

import { AutoRefresh } from "@/components/auto-refresh";
import { getDb } from "@/db/client";
import { listCourts } from "@/db/courts";
import { listScoringMatches } from "@/db/matches";
import { getCurrentTournament } from "@/db/queries";
import { listPublishedDays } from "@/db/schedule";
import { CATEGORY_LABELS } from "@/db/schema";
import { courtViews, scoreboard, type CourtView, type FanScoreboard } from "@/lib/fan-live";
import { fanCourtPath } from "@/lib/fan-chat";
import { SIDES } from "@/lib/match";
import { courtTitle, placeLabel, publishedPlaces, type PublishedPlace } from "@/lib/schedule";

export const dynamic = "force-dynamic";

/** How often the court list looks for a new score. */
const REFRESH_SECONDS = 20;

/** Every court, what is being played on it, and what follows. Open to everyone. */
export default async function FanLivePage() {
  const tournament = getCurrentTournament();
  const database = getDb();
  const courts = tournament ? listCourts(database, tournament.id) : [];
  const rows = tournament ? listScoringMatches(database, tournament.id) : [];
  const places = tournament
    ? publishedPlaces(
        listPublishedDays(database, tournament.id),
        new Map(rows.map((row) => [row.match.id, row.match.matchNumber])),
      )
    : new Map<string, PublishedPlace>();
  const views = courtViews(courts, rows, places);
  const anyLive = views.some((view) => view.live !== null);

  return (
    <div className="flex flex-col gap-8">
      <AutoRefresh seconds={REFRESH_SECONDS} />
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[2px] text-club-lime">
          {tournament?.name ?? "Rubsta Open"} · Fan zone
        </p>
        <h1 className="mt-2 font-serif text-[46px] font-normal leading-none tracking-[-1px]">
          {anyLive ? "On court now" : "Courts"}
        </h1>
        <p className="mt-3 text-[13px] text-club-mist/70">
          Pick a court to watch the score, chat and call the next set.
        </p>
      </div>

      {views.length === 0 ? (
        <p className="border-t border-club-mist/20 pt-5 text-[13px] text-club-mist/70" role="status">
          The courts are not set up yet.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {views.map((view) => (
            <li key={view.court.number}>
              <CourtCard view={view} place={view.next === null ? null : (places.get(view.next.match.id) ?? null)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CourtCard({ view, place }: { view: CourtView; place: PublishedPlace | null }) {
  const board = view.live === null ? null : scoreboard(view.live);
  const next = view.next === null ? null : scoreboard(view.next);

  return (
    <Link
      href={fanCourtPath(view.court.number)}
      className="flex h-full flex-col gap-3 border border-club-mist/25 p-4 hover:border-club-lime"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-serif text-[24px] leading-none">{courtTitle(view.court.number)}</span>
        {board === null ? (
          <span className="text-[10px] font-medium uppercase tracking-[1.5px] text-club-mist/60">
            {next === null ? "Nothing scheduled" : "Up next"}
          </span>
        ) : (
          <span className="bg-club-lime px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[1.5px] text-club-forest">
            Live
          </span>
        )}
      </div>

      {board !== null ? (
        <LiveLines board={board} />
      ) : next !== null ? (
        <NextLines board={next} place={place} />
      ) : (
        <p className="text-[13px] text-club-mist/60">No match listed on this court.</p>
      )}
    </Link>
  );
}

function EventLine({ board }: { board: FanScoreboard }) {
  return (
    <p className="text-[10px] uppercase tracking-[1.5px] text-club-mist/60">
      {CATEGORY_LABELS[board.category]} · {board.roundName}
    </p>
  );
}

function NextLines({ board, place }: { board: FanScoreboard; place: PublishedPlace | null }) {
  return (
    <div className="flex flex-col gap-1">
      <EventLine board={board} />
      <p className="text-[15px]">
        {board.sides.top.name} v {board.sides.bottom.name}
      </p>
      {place === null ? null : <p className="text-[12px] text-club-mist/60">{placeLabel(place)}</p>}
    </div>
  );
}

function LiveLines({ board }: { board: FanScoreboard }) {
  return (
    <div className="flex flex-col gap-1">
      <EventLine board={board} />
      {SIDES.map((side) => (
        <div key={side} className="flex items-baseline justify-between gap-3">
          <span className={`min-w-0 truncate text-[15px] ${board.sides[side].serving ? "font-semibold" : ""}`}>
            {board.sides[side].serving ? "• " : ""}
            {board.sides[side].name}
          </span>
          <span className="flex-none text-[15px] font-medium lining-nums">
            {board.sides[side].sets.join(" ")}
            {board.sides[side].point === null ? "" : ` · ${board.sides[side].point}`}
          </span>
        </div>
      ))}
      {board.situation === null ? null : <p className="text-[12px] text-club-lime">{board.situation}</p>}
    </div>
  );
}
