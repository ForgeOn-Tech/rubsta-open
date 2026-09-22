"use client";

import { useState } from "react";

const MATCHES = [
  { id: "court-1", court: "Court 1", event: "Men’s singles · Quarter-final", players: ["Arjun Mehta", "Rohan Shah"] },
  { id: "court-2", court: "Court 2", event: "Women’s singles · Quarter-final", players: ["Ananya Rao", "Tara Shah"] },
] as const;
type MatchState = {
  stage: "before" | "live" | "finished";
  pick: number | null;
  winner: number | null;
  reactions: number[];
  messages: { name: string; text: string }[];
};
function initialMatch(): MatchState {
  return { stage: "before", pick: null, winner: null, reactions: [0, 0, 0], messages: [
    { name: "Rhea · sample fan", text: "Ready for some great tennis today!" },
    { name: "Kabir · sample fan", text: "That cross-court backhand in warm-up looked sharp." },
  ] };
}

export function EngagementDemo() {
  const [active, setActive] = useState(0);
  const [matches, setMatches] = useState<MatchState[]>(() => MATCHES.map(initialMatch));
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const match = MATCHES[active];
  const state = matches[active];
  const points = matches.reduce((sum, item) => sum + (item.stage === "finished" && item.pick !== null && item.pick === item.winner ? 10 : 0), 0);
  const leaderboard = [
    { name: "You", points },
    { name: "Rhea · sample", points: 10 },
    { name: "Kabir · sample", points: 0 },
  ].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  function update(change: (current: MatchState) => MatchState) {
    setMatches((current) => current.map((item, index) => index === active ? change(item) : item));
  }
  function pick(index: number) {
    update((current) => current.stage === "before" ? { ...current, pick: index } : current);
    setNotice(`Your pick: ${match.players[index]}. You can change it until the match starts.`);
  }
  function start() {
    update((current) => current.stage === "before" ? { ...current, stage: "live" } : current);
    setNotice("Match started. Predictions are now locked.");
  }
  function finish(winner: number) {
    update((current) => current.stage === "live" ? { ...current, stage: "finished", winner } : current);
    setNotice(`${match.players[winner]} wins. ${state.pick === winner ? "Correct prediction! You earned 10 points." : state.pick === null ? "You did not make a prediction for this match." : "No points this time. Try the other court."}`);
  }

  return <section className="fan-engagement" id="fan-engagement" aria-labelledby="engagement-title">
    <div className="fan-section-heading"><div><p className="fan-kicker">Interactive matchday demo</p><h2 id="engagement-title">More than a spectator.</h2></div><div className="eng-points"><strong>{points}</strong><span>Your points</span></div></div>
    <p className="eng-description">Pick a winner before play starts, cheer during the match, then see your points on the leaderboard. Correct picks earn 10 points. No money or prizes.</p>
    <p className="eng-local">Sample matches and chat. Your actions stay in this page and reset on reload; other fans won’t see them.</p>
    <div className="fan-tabs" aria-label="Choose a demo court">{MATCHES.map((item, index) => <button key={item.id} aria-pressed={active === index} onClick={() => { setActive(index); setMessage(""); setNotice(""); }}>{item.court} · {index === 0 ? "Men" : "Women"}</button>)}</div>
    <div className="eng-grid">
      <div>
        <article className="eng-score" aria-label={`${match.court} sample scoreboard`}>
          <div className="eng-score-heading"><span>{match.event}</span><span>{state.stage === "before" ? "Before play" : state.stage === "live" ? "Simulated live" : "Final · Demo"}</span></div>
          {match.players.map((player, index) => <div className="eng-score-row" key={player}><strong>{player}{state.winner === index ? " · Winner" : ""}</strong><span className="mono">{state.stage === "before" ? "—" : state.stage === "live" ? index === 0 ? "6  3  40" : "4  2  30" : state.winner === 0 ? index === 0 ? "6  6" : "4  3" : index === 0 ? "6  3  4" : "4  6  6"}</span></div>)}
          <p>{state.stage === "before" ? "Predictions open until the first point." : state.stage === "live" ? "Illustrative score snapshot. Use the demo controls below to finish the match." : "Match complete. Prediction points have been settled."}</p>
        </article>
        <article className="eng-panel">
          <h3>Who wins this match?</h3>
          <p>{state.stage === "before" ? "Choose your player. You can change your mind before play." : state.pick !== null ? `Your locked pick: ${match.players[state.pick]}` : "Predictions closed. You didn’t submit a pick."}</p>
          <div className="eng-picks">{match.players.map((player, index) => <button key={player} aria-pressed={state.pick === index} disabled={state.stage !== "before"} onClick={() => pick(index)}>{player}<span>{state.pick === index ? "✓ Your pick" : "Select"}</span></button>)}</div>
          {state.stage === "finished" && <p className="eng-outcome">{state.pick === state.winner ? "+10 points · You called it!" : state.pick === null ? "No pick submitted · 0 points" : "Not this time · 0 points"}</p>}
        </article>
        <article className="eng-panel">
          <h3>Make some noise</h3><p>Your reactions for this match. Try cheering more than once.</p>
          <div className="eng-reactions">{["👏 Applause", "🔥 What a shot", "🎾 Come on"].map((label, index) => <button key={label} onClick={() => { update((current) => ({ ...current, reactions: current.reactions.map((count, i) => i === index ? count + 1 : count) })); setNotice(`${label} sent to ${match.court}.`); }}>{label}<strong>{state.reactions[index]}</strong></button>)}</div>
        </article>
        <div className="eng-controls"><p className="fan-kicker">Demo controls · Try the full flow</p>
          <p>1. Pick a winner above. 2. Start the match to lock predictions. 3. Choose the result to test points.</p>
          <div>{state.stage === "before" && <button onClick={start}>Start match</button>}
            {state.stage === "live" && match.players.map((player, index) => <button key={player} onClick={() => finish(index)}>{player} wins</button>)}
            {state.stage === "finished" && <span>Result settled. Try the other court or reset the demo.</span>}
            <button onClick={() => { setMatches(MATCHES.map(initialMatch)); setMessage(""); setNotice("Both demo matches, points, reactions and chat have been reset."); }}>Reset demo</button>
          </div>
        </div>
      </div>
      <div>
        <article className="eng-panel eng-chat"><h3>Court chat</h3><p>{match.court} · Sample conversation</p>
          <div className="eng-messages" role="log" aria-label={`${match.court} chat`} aria-live="polite">{state.messages.map((item, index) => <div key={index}><strong>{item.name}</strong><p>{item.text}</p></div>)}</div>
          <form onSubmit={(event) => { event.preventDefault(); const text = message.trim(); if (!text) return; update((current) => ({ ...current, messages: [...current.messages, { name: "You", text }].slice(-50) })); setMessage(""); setNotice("Message added to your local demo chat."); }}>
            <label htmlFor="demo-chat-message">Your message</label><div><input id="demo-chat-message" maxLength={280} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Cheer them on…" /><button disabled={!message.trim()} type="submit">Send</button></div>
          </form>
        </article>
        <article className="eng-panel"><h3>Fan leaderboard</h3><p>Demo standings · Correct match picks earn 10 points. Equal points share a rank.</p>
          <ol className="eng-leaderboard">{leaderboard.map((fan) => <li key={fan.name}><span>{1 + leaderboard.filter((other) => other.points > fan.points).length}</span><strong>{fan.name}</strong><span>{fan.points} pts</span></li>)}</ol>
        </article>
      </div>
    </div>
    <p className="fan-notice" role="status">{notice}</p>
  </section>;
}
