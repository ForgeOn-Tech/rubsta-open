import Link from "next/link";
import { requireAdmin } from "@/auth/require";
import { getDb } from "@/db/client";
import { getCurrentTournament } from "@/db/queries";
import { listChallengeAttempts, listChallengePlayers } from "@/db/challenges";
import { CHALLENGES, CHALLENGE_KINDS, isChallengeKind, formatChallengeScore } from "@/lib/challenges";
import { AttemptForm, VoidForm } from "./forms";
export default async function ChallengesAdmin({ searchParams }: { searchParams: Promise<{ kind?: string; page?: string }> }) {
  await requireAdmin();
  const query = await searchParams;
  const kind = isChallengeKind(query.kind) ? query.kind : "serve";
  const tournament = getCurrentTournament();
  if (!tournament) return <p>No tournament is available.</p>;
  const { attempts, hasOlder, page } = listChallengeAttempts(getDb(), tournament.id, kind, Number(query.page ?? 1));
  return <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-8">
    <div><h1 className="font-serif text-4xl">Challenge Kit</h1><p className="mt-2 text-muted">Record measured attempts. Each player’s best score appears publicly.</p><Link className="mt-3 inline-block underline" href={`/challenges?kind=${kind}`}>View public leaderboard →</Link></div>
    <nav aria-label="Challenges" className="flex flex-wrap gap-2">{CHALLENGE_KINDS.map(k => <Link key={k} href={`/admin/challenges?kind=${k}`} aria-current={k === kind ? "page" : undefined} style={{ color: k === kind ? "var(--color-accent-fg)" : "var(--color-accent)" }} className={`btn min-h-11 ${k === kind ? "btn-primary" : "btn-outline"}`}>{CHALLENGES[k].title}</Link>)}</nav>
    <section className="border border-line bg-surface-2 p-5"><h2 className="font-serif text-3xl">{CHALLENGES[kind].title}</h2><p className="mt-2 text-sm">{CHALLENGES[kind].rule}</p><AttemptForm key={kind} kind={kind} players={listChallengePlayers(getDb(), tournament.id)} token={crypto.randomUUID()} /></section>
    <section><h2 className="font-serif text-3xl">Recent attempts</h2><p className="mt-2 text-sm text-muted">Page {page} · Up to 100 attempts, including corrections.</p>
      {!attempts.length && <p className="mt-5">{page === 1 ? "No attempts yet. Record the first score above." : "No attempts on this page. Return to newer attempts."}</p>}
      <ul className="mt-4 space-y-3">{attempts.map(({ attempt, name }) => <li key={attempt.id} className="border border-line bg-surface-1 p-4">
        <div className="flex flex-wrap justify-between gap-2"><strong>{name}</strong><span>{formatChallengeScore(kind, attempt.score)}</span></div>
        <p className="mt-2 break-words text-xs text-muted">{new Date(attempt.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST · Recorded by {attempt.recordedBy}</p>
        {attempt.voidedAt ? <p className="mt-2 break-words text-sm text-muted">Voided: {attempt.voidReason} · {attempt.voidedBy}</p> : <VoidForm id={attempt.id} />}
      </li>)}</ul>
      <nav aria-label="Attempt pages" className="mt-5 flex flex-wrap gap-3">
        {page > 1 && <Link className="btn btn-outline min-h-11" href={`/admin/challenges?kind=${kind}&page=${page - 1}`}>Newer attempts</Link>}
        {hasOlder && <Link className="btn btn-outline min-h-11" href={`/admin/challenges?kind=${kind}&page=${page + 1}`}>Older attempts</Link>}
      </nav>
    </section>
  </div>;
}
