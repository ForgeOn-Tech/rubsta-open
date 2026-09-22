"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FanDraw } from "@/db/fan";
import { CATEGORY_LABELS } from "@/db/schema";
import { buildBracket } from "@/lib/draws";
import { Bracket } from "@/app/(admin)/admin/draws/bracket";
import { EngagementDemo } from "./engagement-demo";

const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("fan-favourites", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("fan-favourites", callback);
  };
};
const serverSnapshot = () => "[]";
function readSaved(key: string) {
  try { return localStorage.getItem(key) ?? "[]"; } catch { return "[]"; }
}
function parseSaved(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch { return []; }
}
function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(value));
}

export function FanHub({ tournamentId, name, venue, startsOn, endsOn, draws, demo = false }: {
  demo?: boolean;
  tournamentId: string; name: string; venue: string | null;
  startsOn: string | null; endsOn: string | null; draws: FanDraw[];
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [view, setView] = useState("draws");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const storageKey = `rubsta-favourites:${tournamentId}`;
  const rawSaved = useSyncExternalStore(subscribe, () => readSaved(storageKey), serverSnapshot);
  const saved = parseSaved(rawSaved);
  const allPlayers = draws.flatMap((draw) => draw.slots.filter((slot) => slot.entryId !== null)
    .map((slot) => ({ ...slot, category: draw.category })));
  const players = allPlayers.filter((player) => (category === "all" || player.category === category)
    && player.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
    && (view !== "following" || saved.includes(player.entryId!)));
  const visibleDraws = draws.filter((draw) => category === "all" || draw.category === category);
  const followedCount = allPlayers.filter((player) => saved.includes(player.entryId!)).length;

  function toggle(id: string) {
    const current = parseSaved(readSaved(storageKey));
    const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      window.dispatchEvent(new Event("fan-favourites"));
      setNotice(current.includes(id) ? "Removed from your favourites." : "Saved to your favourites on this device.");
    } catch { setNotice("Your browser could not save favourites. Enable site storage and try again."); }
  }

  return <div className="club fan">
    {demo && <div className="fan-demo" role="note">Demo preview · Fictional players and sample draws. <a href="/fan">Exit demo ↗</a></div>}
    <a className="fan-skip" href="#fan-content">Skip to content</a>
    <header className="fan-header">
      <a className="fan-wordmark" href="https://rubstaopen.com">Rubsta Open<span>POWERED BY FORGELABS</span></a>
      <span className="fan-tag">THE FAN CLUB</span>
      <a className="fan-website" href="https://rubstaopen.com">Tournament website ↗</a>
    </header>
    <main id="fan-content">
      <section className="fan-hero" aria-labelledby="fan-title">
        <div><p className="fan-kicker">{name} / Courtside, wherever you are</p>
          <h1 id="fan-title">A front-row seat.<br /><em>For every fan.</em></h1>
          <p className="fan-intro">Find your favourites. Explore the draw. Follow their road to the final.</p>
          <a className="fan-cta" href={demo ? "#fan-engagement" : "#fan-explore"}>{demo ? "Try fan engagement" : "Explore the tournament"} <span aria-hidden="true">↘</span></a>
        </div>
        <div className="fan-court" aria-hidden="true"><div className="fan-court-inner" /><span className="fan-ball" /><span className="fan-court-label">LOVE THE GAME.</span></div>
      </section>
      <section className="fan-facts" aria-label="Tournament information">
        <div><span>Tournament</span><strong>{name}</strong></div>
        <div><span>Dates</span><strong>{startsOn ? `${dateLabel(startsOn)}${endsOn && endsOn !== startsOn ? ` – ${dateLabel(endsOn)}` : ""}` : "See tournament website"}</strong></div>
        <div><span>Venue</span><strong>{venue || "See tournament website"}</strong></div>
        <div><span>Published draws</span><strong>{draws.length.toString().padStart(2, "0")}</strong></div>
      </section>
      {demo && <EngagementDemo />}
      <section className="fan-explore" id="fan-explore" aria-labelledby="explore-title">
        <div className="fan-section-heading"><div><p className="fan-kicker">Inside the tournament</p><h2 id="explore-title">Your courtside companion.</h2></div>
          <button className="fan-refresh" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())}>{refreshing ? "Refreshing…" : "Refresh draws ↻"}</button></div>
        <div className="fan-tabs" aria-label="Explore views">
          {[["draws", "The draws"], ["players", "Players & teams"], ["following", `My favourites (${followedCount})`]].map(([id, label]) =>
            <button key={id} aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>)}
        </div>
        <div className="fan-filters">
          <label>Event<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All published events</option>{draws.map((draw) => <option key={draw.id} value={draw.category}>{CATEGORY_LABELS[draw.category]}</option>)}</select></label>
          {view !== "draws" && <label>Find a player or team<input type="search" placeholder="Search by name" value={query} onChange={(event) => setQuery(event.target.value)} /></label>}
          <p>{view === "following" ? "Favourites stay on this device. No sign-in needed." : "Draws appear here when the organisers publish them."}</p>
        </div>
        {view === "draws" ? (visibleDraws.length ? visibleDraws.map((draw) => <article className="fan-draw" key={draw.id}>
          <div className="fan-draw-heading"><h3>{CATEGORY_LABELS[draw.category]}</h3><span>{draw.size} lines · Published</span></div>
          <Bracket rounds={buildBracket(draw.slots)} labels={new Map(draw.slots.filter((slot) => slot.entryId).map((slot) => [slot.entryId!, slot.label]))} />
        </article>) : <Empty title="The stage is being set." text="The organisers haven’t published any draws yet. Come back to see the opening matchups and the road to the final." />)
          : players.length ? <ul className="fan-players">{players.map((player) => <li key={player.entryId}>
            <div className="fan-initial" aria-hidden="true">{player.label.slice(0, 1)}</div>
            <div className="fan-player-name"><h3>{player.label}</h3><p>{CATEGORY_LABELS[player.category]}{player.seed ? ` · Seed ${player.seed}` : ""}</p></div>
            <button aria-label={`${saved.includes(player.entryId!) ? "Unfollow" : "Follow"} ${player.label}`} aria-pressed={saved.includes(player.entryId!)} onClick={() => toggle(player.entryId!)}>{saved.includes(player.entryId!) ? "★ Saved" : "☆ Follow"}</button>
          </li>)}</ul> : <Empty title={query ? "No matching players." : view === "following" ? "Make it your tournament." : "Meet the players, soon."} text={query ? "Try another name or choose a different event." : view === "following" ? "Follow players and teams from the Players & teams view to keep your favourites together here." : "Players and teams will appear with the published draws."} />}
        <p className="fan-notice" role="status">{notice}</p>
      </section>
      <aside className="fan-matchday"><span className="fan-kicker">Matchday</span><h2>Next up: the action.</h2><p>Live scores, streams and the order of play aren’t available in the fan app yet. Check the tournament website for event announcements.</p><a href="https://rubstaopen.com">Visit Rubsta Open ↗</a></aside>
    </main>
    <footer className="fan-footer"><span>Rubsta Open · The Fan Club</span><span>For the love of tennis.</span></footer>
  </div>;
}

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="fan-empty"><span aria-hidden="true">↗</span><h3>{title}</h3><p>{text}</p></div>;
}
