"use client";

import { useState } from "react";

type ShareState = "idle" | "working" | "shared" | "saved" | "failed";

// Long enough for the browser to start the download before the file URL goes.
const REVOKE_DELAY_MS = 10_000;
const RESULT_MESSAGES: Record<"shared" | "saved" | "failed", string> = {
  shared: "Card shared.",
  saved: "Card saved as an image.",
  failed: "Your card could not be made. Try again.",
};

/** Shares the player card image where the browser can, and saves it as a file otherwise. */
export function ShareCardButton({
  imagePath,
  fileName,
  title,
}: {
  imagePath: string;
  fileName: string;
  title: string;
}) {
  const [state, setState] = useState<ShareState>("idle");

  async function shareCard() {
    setState("working");
    try {
      const response = await fetch(imagePath);
      if (!response.ok) throw new Error(`The player card image returned status ${response.status}.`);
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: blob.type });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title });
        setState("shared");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
      setState("saved");
    } catch (error) {
      // Closing the share sheet is the player's choice, not a failure.
      if (error instanceof DOMException && error.name === "AbortError") {
        setState("idle");
        return;
      }
      console.warn("Sharing the player card failed.", error);
      setState("failed");
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button type="button" className="pill pill-outline" onClick={shareCard} disabled={state === "working"}>
        {state === "working" ? "Making your card…" : "Share card"}
      </button>
      {state === "idle" || state === "working" ? null : (
        <p role="status" className="text-[11px] text-club-muted">
          {RESULT_MESSAGES[state]}
        </p>
      )}
    </div>
  );
}
