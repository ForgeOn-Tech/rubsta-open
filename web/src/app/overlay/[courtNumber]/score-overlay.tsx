"use client";

import { useEffect, useState } from "react";
import { CATEGORY_LABELS } from "@/db/schema";
import type { FanScoreboard } from "@/lib/fan-live";
import { SIDES } from "@/lib/match";

interface OverlayData {
  courtNumber: number;
  tournamentName: string;
  board: FanScoreboard | null;
}

export function ScoreOverlay({ initial }: { initial: OverlayData }) {
  const [data, setData] = useState(initial);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    async function poll() {
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(`/api/overlay/${initial.courtNumber}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Score unavailable");
        const next: OverlayData = await response.json();
        if (!stopped) { setData(next); setStale(false); }
      } catch {
        if (!stopped) setStale(true);
      } finally {
        clearTimeout(timeout);
        // Keep polling when OBS puts the page in the background; never overlap requests.
        if (!stopped) timer = setTimeout(poll, 2000);
      }
    }
    void poll();
    return () => { stopped = true; clearTimeout(timer); controller?.abort(); };
  }, [initial.courtNumber]);

  const board = data.board;
  return <main className="obs-overlay">
    <section className="obs-score" aria-label={`Court ${data.courtNumber} scoreboard`}>
      <header className="obs-heading"><strong>{data.tournamentName}</strong><span>Court {data.courtNumber}</span></header>
      {board ? <>
        <div className="obs-event">{CATEGORY_LABELS[board.category]} · {board.roundName} · M{board.matchNumber}</div>
        <table aria-label="Live score"><thead><tr><th scope="col">Player</th>{board.sides.top.sets.map((_, index) => <th scope="col" key={index}>S{index + 1}</th>)}<th scope="col">PTS</th></tr></thead>
          <tbody>{SIDES.map(side => {
            const player = board.sides[side];
            return <tr key={side}><th scope="row"><span className="obs-server" aria-label={player.serving ? "Serving" : undefined}>{player.serving ? "●" : ""}</span><span className="obs-name">{player.name}</span></th>{player.sets.map((score, index) => <td key={index}>{score}</td>)}<td className="obs-point">{player.point ?? "–"}</td></tr>;
          })}</tbody>
        </table>
        {board.situation && <div className="obs-situation">{board.situation}</div>}
      </> : <p className="obs-waiting">Waiting for play</p>}
      {stale && <p className="obs-reconnecting" role="status">Score updates paused · reconnecting</p>}
    </section>
  </main>;
}
