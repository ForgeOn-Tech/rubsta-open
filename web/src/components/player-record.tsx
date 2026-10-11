import Link from "next/link";
import type { PlayerCardData } from "@/db/player-cards";
import { CATEGORY_LABELS, HAND_LABELS } from "@/db/schema";
import { certificateLabel } from "@/lib/certificates";

export function PlayerRecord({ card, token }: { card: PlayerCardData; token?: string }) {
  return <div className="space-y-9 break-words [overflow-wrap:anywhere]">
    <header className="border border-club-line bg-club-paper p-6 sm:p-8">
      <p className="text-xs uppercase tracking-[2px]">Rubsta Open · Player Card</p>
      <h1 className="mt-3 break-words font-serif text-5xl">{card.name}</h1>
      <p className="mt-3 text-club-muted">{[card.club, card.plays ? HAND_LABELS[card.plays] : null, card.playerId].filter(Boolean).join(" · ")}</p>
      <dl className="mt-6 grid grid-cols-3 gap-3">{[["Matches", card.totals.played], ["Won", card.totals.won], ["Lost", card.totals.lost]].map(([label,value]) => <div key={label}><dt className="text-xs uppercase tracking-wider">{label}</dt><dd className="mt-2 font-serif text-4xl">{value}</dd></div>)}</dl>
      <p className="mt-3 text-xs text-club-muted">Recorded matches with play; byes and walkovers are excluded from these totals.</p>
      {card.ranking && <p className="mt-5 text-sm">Best ranking: {card.ranking} <span className="text-club-muted">· Added by player</span></p>}
    </header>
    <section aria-label="Tournament results"><h2 className="font-serif text-3xl">Tournament results</h2>
      {!card.tournaments.length && <p className="mt-4 text-club-muted">No recorded tournament results yet.</p>}
      {card.tournaments.map((t,i) => <article key={i} className="mt-5 border-t border-club-line pt-5"><h3 className="text-lg font-medium">{t.name}</h3><ul className="mt-3 space-y-2">{t.results.map(r => <li key={r.category} className="flex flex-wrap justify-between gap-2"><span>{CATEGORY_LABELS[r.category]}</span><strong>{r.label}</strong></li>)}</ul></article>)}
    </section>
    <section aria-label="Match history"><h2 className="font-serif text-3xl">Match history</h2><p className="mt-2 text-sm text-club-muted">Scores are shown with the match winner first. Doubles results belong to the team.</p>
      {!card.tournaments.some(t => t.history.length) && <p className="mt-4 text-club-muted">Completed matches will appear here.</p>}
      {card.tournaments.flatMap(t => t.history.map(m => <article key={m.id} className="mt-4 border border-club-line p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="min-w-0 break-words font-medium">{m.result} · vs {m.opponent}</h3><span>{m.score}</span></div><p className="mt-2 text-sm text-club-muted">{t.name} · {CATEGORY_LABELS[m.category]} · {m.round}</p><Link href={`/results/${m.id}`} className="mt-3 inline-block text-sm underline">View match result →</Link></article>))}
    </section>
    <section aria-label="Earned certificates"><h2 className="font-serif text-3xl">Earned certificates</h2>
      {!card.tournaments.some(t => t.certificates.length) && <p className="mt-4 text-club-muted">Certificates appear after an eligible completed match or an event win.</p>}
      {card.tournaments.map((t,i) => t.certificates.length > 0 && <div key={i} className="mt-5"><h3 className="font-medium">{t.name}</h3><div className="mt-3 flex flex-wrap gap-3">{t.certificates.map(c => <a key={c.entryId+c.kind} href={token ? `/api/player-cards/${token}/certificates/${c.entryId}/${c.kind}` : `/home/certificates/${c.entryId}/${c.kind}`} className="pill pill-outline max-w-full whitespace-normal text-center" download>{certificateLabel(c)} ↓</a>)}</div></div>)}
    </section>
    <section aria-label="Player-added history"><h2 className="font-serif text-3xl">Previous tournaments</h2><p className="mt-2 text-sm text-club-muted">Added by the player; not verified tournament results.</p>
      {!card.previous.length ? <p className="mt-4 text-club-muted">No previous tournaments added.</p> : <ul className="mt-4 divide-y divide-club-line">{card.previous.map((t,i) => <li key={i} className="py-3"><strong>{t.name}</strong><p className="text-sm text-club-muted">{t.year} · {t.result}</p></li>)}</ul>}
    </section>
  </div>;
}
