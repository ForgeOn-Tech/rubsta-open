"use client";

import { useEffect, useRef } from "react";

import { CONFETTI_PIECES, burstFrom } from "@/components/confetti";
import type { FanFeed } from "@/lib/fan-feed";

const CELEBRATION_BURST = 40;
const SHOWN_KEY = "fan-set-calls-shown";

/** The set calls this browser has already celebrated, so a reload does not repeat one. */
function shownCalls(): Set<string> {
  try {
    return new Set(JSON.parse(window.sessionStorage.getItem(SHOWN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function markShown(key: string): void {
  try {
    window.sessionStorage.setItem(SHOWN_KEY, JSON.stringify([...shownCalls(), key]));
  } catch {
    // Without storage the burst may repeat after a reload, which is harmless.
  }
}

/** How the fan's latest set call went, with a confetti burst the first time they got one right. */
export function SetCall({ call }: { call: NonNullable<FanFeed["lastCall"]> }) {
  const banner = useRef<HTMLParagraphElement>(null);
  const right = call.own === call.winner;
  const key = `${call.matchId}:${call.setNumber}`;

  useEffect(() => {
    if (!right || banner.current === null || shownCalls().has(key)) return;
    markShown(key);
    burstFrom(banner.current, CONFETTI_PIECES, CELEBRATION_BURST);
  }, [right, key]);

  return (
    <p
      ref={banner}
      role="status"
      className={`border px-4 py-3 text-[13px] ${right ? "border-club-lime text-club-lime" : "border-club-mist/25 text-club-mist/80"}`}
    >
      {right ? (
        <>
          <strong className="font-semibold">You called it!</strong> Set {call.setNumber} to {call.winnerName}. +1 point
          on the leaderboard.
        </>
      ) : (
        <>
          Set {call.setNumber} to {call.winnerName}. Your pick missed this one.
        </>
      )}
    </p>
  );
}
