"use client";

import { useState } from "react";

export function OverlayLink({ courtNumber }: { courtNumber: number }) {
  const path = `/overlay/${courtNumber}`;
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).href);
      setMessage("Scoreboard link copied.");
    } catch {
      setMessage("Open the scoreboard and copy the address from your browser.");
    }
  }
  return <div className="mt-5 border-t border-line pt-4 text-sm">
    <p className="font-medium">Score overlay for OBS</p>
    <p className="mt-2 text-muted">In OBS, choose Sources → + → Browser and paste this link. Set width to 1920 and height to 1080, then place it above your camera. Scores update automatically while the umpire scores this court.</p>
    <div className="mt-3 flex flex-wrap items-center gap-4"><button type="button" onClick={copy} className="border border-line px-3 py-2">Copy scoreboard link</button><a href={path} target="_blank" rel="noreferrer" className="underline">Open scoreboard ↗</a></div>
    <p aria-live="polite" className="mt-2 text-muted">{message}</p>
  </div>;
}
