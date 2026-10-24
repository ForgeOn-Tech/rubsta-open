"use client";

import { useState } from "react";

import { ScoringLink as Link } from "@/components/scoring-link";
import { filterMatchGroups, type MatchCardView, type MatchGroupView } from "@/lib/scoring-search";

/** The umpire's match list, with a search box to find a match by player, number or court. */
export function MatchFinder({ groups }: { groups: readonly MatchGroupView[] }) {
  const [search, setSearch] = useState("");
  const shown = filterMatchGroups(groups, search);

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="match-search" className="thead">
          Find a match
        </label>
        <input
          id="match-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Player, M23 or court 2"
          autoComplete="off"
          enterKeyHint="search"
          className="field"
        />
      </div>
      {shown.length === 0 ? (
        <p className="card p-4 text-[13px] text-muted" role="status">
          No match fits &ldquo;{search.trim()}&rdquo;. Try a surname or a match number such as M12.
        </p>
      ) : (
        shown.map((group) => <MatchGroup key={group.id} group={group} />)
      )}
    </>
  );
}

function MatchGroup({ group }: { group: MatchGroupView }) {
  return (
    <section aria-labelledby={`group-${group.id}`}>
      <h2 id={`group-${group.id}`} className="thead">
        {group.title} · {group.cards.length}
      </h2>
      <ul className="mt-2 flex flex-col gap-2">
        {group.cards.map((card) => (
          <li key={card.id}>
            <MatchCard card={card} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function MatchCard({ card }: { card: MatchCardView }) {
  const content = (
    <>
      <div className="mono flex justify-between gap-3 text-[10px] uppercase text-dim">
        <span>{card.heading}</span>
        <span className="flex-none">{card.court}</span>
      </div>
      <div className="mt-1.5 truncate text-[14px] font-semibold text-ink">{card.top}</div>
      <div className="truncate text-[14px] font-semibold text-ink">{card.bottom}</div>
      {card.summary ? <div className="mono mt-1 text-[12px] text-muted">{card.summary}</div> : null}
      {card.place === null ? null : <div className="mono mt-1 text-[11px] text-muted">{card.place}</div>}
    </>
  );

  if (!card.linked) return <div className="card p-3">{content}</div>;
  return (
    <Link href={`/score/${card.id}`} className="card block p-3 hover:border-accent">
      {content}
    </Link>
  );
}
