import Link from "next/link";

import { signOutAction } from "@/auth/actions";
import { canAccessAdmin, requireScorer } from "@/auth/require";
import { getDb } from "@/db/client";
import { listScoringMatches, type ScoringMatchRow } from "@/db/matches";
import { getCurrentTournament } from "@/db/queries";
import { CATEGORY_LABELS } from "@/lib/entries";
import {
  SCORING_GROUP_ORDER,
  SCORING_GROUP_TITLES,
  groupScoringMatches,
  matchSummary,
  sideLabel,
} from "@/lib/scoring-display";

export const dynamic = "force-dynamic";

/** Every match an umpire can pick up, grouped by where it stands. */
export default async function ScoringListPage() {
  const user = await requireScorer();
  const tournament = getCurrentTournament();
  const groups = tournament ? groupScoringMatches(listScoringMatches(getDb(), tournament.id)) : null;
  const shownGroups = groups
    ? SCORING_GROUP_ORDER.filter((group) => groups[group].length > 0)
    : [];

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
            ) : (
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
        <h1 className="mt-3 text-[20px] font-semibold tracking-[-0.01em]">Matches</h1>
      </header>

      <main className="flex flex-col gap-6 px-5 py-5">
        {groups === null ? (
          <p className="card p-4 text-[13px] text-muted" role="status">
            No tournament has been set up.
          </p>
        ) : shownGroups.length === 0 ? (
          <p className="card p-4 text-[13px] text-muted" role="status">
            No matches yet. They appear here once an admin publishes a draw.
          </p>
        ) : (
          shownGroups.map((group) => (
            <section key={group} aria-labelledby={`group-${group}`}>
              <h2 id={`group-${group}`} className="thead">
                {SCORING_GROUP_TITLES[group]} · {groups[group].length}
              </h2>
              <ul className="mt-2 flex flex-col gap-2">
                {groups[group].map((row) => (
                  <li key={row.match.id}>
                    <MatchCard row={row} linked={group !== "waiting"} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </main>
    </div>
  );
}

function MatchCard({ row, linked }: { row: ScoringMatchRow; linked: boolean }) {
  const { match } = row;
  const summary = matchSummary(row);
  const content = (
    <>
      <div className="mono flex justify-between gap-3 text-[10px] uppercase text-dim">
        <span>
          M{match.matchNumber} · {CATEGORY_LABELS[row.category]} · {match.roundName}
        </span>
        <span className="flex-none">{match.court === null ? "No court" : `Court ${match.court}`}</span>
      </div>
      <div className="mt-1.5 truncate text-[14px] font-semibold text-ink">
        {sideLabel(row.top, match.topSlot).name}
      </div>
      <div className="truncate text-[14px] font-semibold text-ink">
        {sideLabel(row.bottom, match.bottomSlot).name}
      </div>
      {summary ? <div className="mono mt-1 text-[12px] text-muted">{summary}</div> : null}
    </>
  );

  if (!linked) return <div className="card p-3">{content}</div>;
  return (
    <Link href={`/score/${match.id}`} className="card block p-3 hover:border-accent">
      {content}
    </Link>
  );
}
