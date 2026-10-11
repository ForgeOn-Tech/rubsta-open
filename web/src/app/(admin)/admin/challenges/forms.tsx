"use client";
import { useActionState } from "react";
import { CHALLENGES, type ChallengeKind } from "@/lib/challenges";
import { recordAttempt, voidAttempt } from "./actions";
const inputClass = "mt-2 min-h-11 w-full border border-line bg-surface-1 px-3 py-2";
export function AttemptForm({ players, kind, token }: { players: { userId: string; name: string }[]; kind: ChallengeKind; token: string }) {
  const [state, action, pending] = useActionState(recordAttempt, { error: null, savedAt: null, token });
  const challenge = CHALLENGES[kind];
  if (!players.length) return <p className="mt-4">Players will appear here after registering and completing their profile.</p>;
  return <form action={action} className="mt-5 space-y-4">
    <input type="hidden" name="kind" value={kind} />
    <label className="block">Player<select name="player" required className={inputClass} defaultValue=""><option value="" disabled>Choose a registered player</option>{players.map(p => <option key={p.userId} value={p.userId}>{p.name} · {p.userId.slice(-6)}</option>)}</select></label>
    <label className="block">Score ({challenge.unit})<input key={state.token} name="score" type="number" inputMode={kind === "serve" ? "decimal" : "numeric"} min={challenge.min} max={challenge.max} step={challenge.step} required className={inputClass} aria-describedby="score-help" /></label>
    <p id="score-help" className="text-sm text-muted">{challenge.help}</p>
    {state.error && <p role="alert" className="text-bad">{state.error}</p>}
    {!state.error && state.savedAt && <p role="status">Attempt saved. The leaderboard is updated.</p>}
    <button disabled={pending} className="btn btn-primary min-h-11 disabled:opacity-50">{pending ? "Saving…" : "Record attempt"}</button>
  </form>;
}
export function VoidForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(voidAttempt, { error: null, savedAt: null, token: "" });
  return <details className="mt-3"><summary className="cursor-pointer text-sm underline">Correct this attempt</summary><form action={action} className="mt-3 flex flex-wrap items-end gap-3">
    <input type="hidden" name="id" value={id} />
    <label className="block min-w-0 flex-1 text-sm">Reason<input name="reason" minLength={3} maxLength={200} required className={inputClass} placeholder="For example, wrong measurement" /></label>
    <button disabled={pending} className="btn btn-outline min-h-11">{pending ? "Removing…" : "Void attempt"}</button>
    {state.error && <p role="alert" className="w-full text-bad">{state.error}</p>}
  </form><p className="mt-2 text-xs text-muted">Removes this score from the leaderboard. The record is kept; enter a new attempt for a corrected score.</p></details>;
}
