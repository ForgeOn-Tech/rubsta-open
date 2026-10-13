import Link from "next/link";
import { getDb } from "@/db/client";
import { getCurrentTournament } from "@/db/queries";
import { challengeLeaderboard } from "@/db/challenges";
import { CHALLENGES, CHALLENGE_KINDS, isChallengeKind, formatChallengeScore } from "@/lib/challenges";
export default async function ChallengesPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const query = await searchParams;
  const kind = isChallengeKind(query.kind) ? query.kind : "serve";
  const tournament = getCurrentTournament();
  const rows = tournament ? challengeLeaderboard(getDb(), tournament.id, kind) : [];
  return <div>
    <p className="text-xs uppercase tracking-[2px]">Rubsta Open · Challenge Kit</p>
    <h1 className="mt-4 font-serif text-5xl">Put your skills to the test.</h1>
    <p className="mt-4 max-w-xl text-club-muted">Take your turn at the challenge station. An organiser records your result; your best attempt takes its place here.</p>
    <nav aria-label="Challenges" className="my-7 flex flex-wrap gap-2">{CHALLENGE_KINDS.map(k => <Link key={k} href={`/challenges?kind=${k}`} aria-current={k === kind ? "page" : undefined} className={`pill ${k === kind ? "pill-primary" : "pill-outline"}`}>{CHALLENGES[k].title}</Link>)}</nav>
    <section aria-label="Leaderboard" className="border border-club-line bg-club-paper p-5 sm:p-8">
      <h2 className="font-serif text-3xl">{CHALLENGES[kind].title}</h2><p className="mt-2 text-sm">{CHALLENGES[kind].rule} Equal scores share a rank.</p>
      {rows.length ? <ol className="mt-6 divide-y divide-club-line">{rows.map(row => <li key={row.userId} className="flex items-center gap-3 py-4">
        <span className="w-7 shrink-0 text-xl" aria-label={`Rank ${row.rank}`}>{row.rank}</span><div className="min-w-0 flex-1"><p className="break-words font-medium">{row.name}</p><p className="text-xs text-club-muted">{row.attempts} {row.attempts === 1 ? "attempt" : "attempts"}</p></div><strong className="shrink-0">{formatChallengeScore(kind, row.score)}</strong>
      </li>)}</ol> : <p className="py-8 text-club-muted">No scores yet. Be the first to try this challenge.</p>}
    </section>
    <a href={`/challenges?kind=${kind}`} className="pill pill-outline mt-5">Refresh scores</a>
    <p className="mt-3 text-xs text-club-muted">Scores are entered by organisers. Refresh to see new attempts.</p>
  </div>;
}
