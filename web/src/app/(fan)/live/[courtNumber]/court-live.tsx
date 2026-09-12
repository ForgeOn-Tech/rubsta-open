"use client";

import { useEffect, useState } from "react";

import { CourtChat } from "./court-chat";
import { PredictionPanel } from "./prediction-panel";
import { ReactionsRow } from "./reactions-row";
import { CATEGORY_LABELS } from "@/db/schema";
import { FAN_FEED_INTERVAL_MS, fanFeedPath, type FanFeed } from "@/lib/fan-feed";
import type { FanScoreboard } from "@/lib/fan-live";
import type { FormAction } from "@/lib/form-state";
import { SIDES } from "@/lib/match";

const VIEWER_KEY = "fan-viewer-id";

/** One id per browser tab, so a fan watching on two tabs counts twice and no more. */
function viewerId(): string {
  const existing = window.sessionStorage.getItem(VIEWER_KEY);
  if (existing !== null) return existing;
  const fresh = crypto.randomUUID();
  window.sessionStorage.setItem(VIEWER_KEY, fresh);
  return fresh;
}

/**
 * The live half of a court page. It asks the server for the score, the chat
 * and the votes every few seconds, and stops while the tab is in the
 * background so a phone in a pocket costs nothing.
 */
export function CourtLive({
  courtNumber,
  embedUrl,
  initialFeed,
  predictAction,
  reactAction,
  postMessageAction,
}: {
  courtNumber: number;
  embedUrl: string | null;
  initialFeed: FanFeed;
  predictAction: FormAction;
  reactAction: FormAction;
  postMessageAction: FormAction;
}) {
  const [feed, setFeed] = useState<FanFeed>(initialFeed);

  useEffect(() => {
    let stopped = false;
    const path = fanFeedPath(courtNumber, viewerId());

    const poll = async (): Promise<void> => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch(path, { cache: "no-store" });
        if (!response.ok) return;
        const next = (await response.json()) as FanFeed;
        if (!stopped) setFeed(next);
      } catch {
        // A dropped signal in a crowd is normal; the next poll tries again.
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), FAN_FEED_INTERVAL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [courtNumber]);

  return (
    <div className="flex flex-col gap-6">
      <Stream embedUrl={embedUrl} live={feed.live !== null} watching={feed.watching} />
      {feed.live !== null ? (
        <Scoreboard board={feed.live} />
      ) : feed.next !== null ? (
        <UpNext board={feed.next.board} place={feed.next.place} />
      ) : (
        <p className="border-t border-club-mist/20 pt-5 text-[13px] text-club-mist/70" role="status">
          No match is listed on this court.
        </p>
      )}

      {feed.live === null ? null : (
        <ReactionsRow
          matchId={feed.live.matchId}
          counts={feed.reactions}
          own={feed.ownReactions}
          signedIn={feed.signedIn}
          action={reactAction}
        />
      )}

      {feed.live === null || feed.predictions === null ? null : (
        <PredictionPanel
          matchId={feed.live.matchId}
          board={feed.live}
          prediction={feed.predictions}
          signedIn={feed.signedIn}
          action={predictAction}
        />
      )}

      <CourtChat
        courtNumber={courtNumber}
        messages={feed.messages}
        signedIn={feed.signedIn}
        action={postMessageAction}
      />
    </div>
  );
}

function Stream({
  embedUrl,
  live,
  watching,
}: {
  embedUrl: string | null;
  live: boolean;
  watching: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        {live ? (
          <span className="bg-club-lime px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[1.5px] text-club-forest">
            Live
          </span>
        ) : (
          <span className="text-[10px] font-medium uppercase tracking-[1.5px] text-club-mist/60">
            Not playing
          </span>
        )}
        <span className="text-[10px] font-medium uppercase tracking-[1.5px] text-club-mist/60 lining-nums">
          {watching} watching
        </span>
      </div>
      {embedUrl === null ? (
        <div className="flex aspect-video items-center justify-center border border-club-mist/25 text-[11px] uppercase tracking-[1.5px] text-club-mist/50">
          No stream on this court
        </div>
      ) : (
        <iframe
          src={embedUrl}
          title="Court stream"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="aspect-video w-full border border-club-mist/25"
        />
      )}
    </div>
  );
}

function EventLine({ board }: { board: FanScoreboard }) {
  return (
    <p className="text-[10px] uppercase tracking-[1.5px] text-club-mist/60">
      M{board.matchNumber} · {CATEGORY_LABELS[board.category]} · {board.roundName}
    </p>
  );
}

function Scoreboard({ board }: { board: FanScoreboard }) {
  return (
    <section aria-label="Score" className="flex flex-col gap-2 border-t border-club-mist/20 pt-5">
      <EventLine board={board} />
      {SIDES.map((side) => {
        const player = board.sides[side];
        return (
          <div key={side} className="flex items-baseline justify-between gap-4">
            <span className={`min-w-0 truncate text-[18px] ${player.winner ? "font-semibold" : ""}`}>
              {player.serving ? <span aria-label="Serving">• </span> : null}
              {player.name}
            </span>
            <span className="flex flex-none items-baseline gap-3 lining-nums">
              <span className="text-[18px] font-medium">{player.sets.join("  ")}</span>
              {player.point === null ? null : (
                <span className="w-8 text-right text-[18px] font-semibold text-club-lime">{player.point}</span>
              )}
            </span>
          </div>
        );
      })}
      {board.situation === null ? null : (
        <p className="text-[12px] text-club-lime">{board.situation}</p>
      )}
    </section>
  );
}

function UpNext({ board, place }: { board: FanScoreboard; place: string | null }) {
  return (
    <section aria-label="Up next" className="flex flex-col gap-1 border-t border-club-mist/20 pt-5">
      <p className="text-[10px] font-medium uppercase tracking-[1.5px] text-club-lime">Up next</p>
      <EventLine board={board} />
      <p className="text-[16px]">
        {board.sides.top.name} v {board.sides.bottom.name}
      </p>
      {place === null ? null : <p className="text-[12px] text-club-mist/60">{place}</p>}
    </section>
  );
}
