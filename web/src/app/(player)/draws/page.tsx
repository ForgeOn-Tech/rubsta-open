import Link from "next/link";

import { requireUser } from "@/auth/require";
import { getDb } from "@/db/client";
import { listScoringMatches } from "@/db/matches";
import { listTeamEntryIds } from "@/db/partners";
import { getCurrentTournament } from "@/db/queries";
import { CATEGORIES, CATEGORY_LABELS } from "@/db/schema";
import { PLAYER_DRAWS_PATH, teamMatches } from "@/lib/player-matches";

export const dynamic = "force-dynamic";

/** Each event's draw, once an admin publishes it. */
export default async function PlayerDrawsPage() {
  const user = await requireUser();
  const tournament = getCurrentTournament();
  const database = getDb();
  const rows = tournament ? listScoringMatches(database, tournament.id) : [];
  const team = new Set(listTeamEntryIds(database, user.id));
  const events = CATEGORIES.map((category) => {
    const inEvent = rows.filter((row) => row.category === category);
    return { category, published: inEvent.length > 0, playing: teamMatches(inEvent, team).length > 0 };
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[2px] text-club-muted">
          {tournament?.name ?? "Rubsta Open"} · Draws
        </p>
        <h1 className="mt-2 font-serif text-[46px] font-normal leading-none tracking-[-1px]">Draws</h1>
      </div>

      <ul className="border-t border-club-line">
        {events.map((event) => (
          <li key={event.category} className="border-b border-club-line">
            {event.published ? (
              <Link
                href={`${PLAYER_DRAWS_PATH}/${event.category}`}
                className="flex items-center justify-between gap-4 py-4 hover:bg-club-paper sm:px-2"
              >
                <span className="font-serif text-[26px] leading-tight">{CATEGORY_LABELS[event.category]}</span>
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-[1.5px] text-club-deep">
                  {event.playing ? "You play in this draw" : "View draw"} <span aria-hidden="true">→</span>
                </span>
              </Link>
            ) : (
              <div className="flex items-center justify-between gap-4 py-4 sm:px-2">
                <span className="font-serif text-[26px] leading-tight text-club-muted">
                  {CATEGORY_LABELS[event.category]}
                </span>
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-[1.5px] text-club-muted">
                  Not published yet
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
