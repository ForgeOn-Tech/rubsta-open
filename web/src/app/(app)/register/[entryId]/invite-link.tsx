"use client";

import { useState, useSyncExternalStore } from "react";

function subscribeToNothing(): () => void {
  return () => {};
}

type CopyState = "idle" | "copied" | "failed";

/** The partner invitation link, with a copy button. */
export function InviteLink({ path }: { path: string }) {
  const origin = useSyncExternalStore(
    subscribeToNothing,
    () => window.location.origin,
    () => "",
  );
  const [copy, setCopy] = useState<CopyState>("idle");
  const url = `${origin}${path}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopy("copied");
    } catch (error) {
      console.warn("Copying the partner link failed.", error);
      setCopy("failed");
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="caps" htmlFor="invite-link">
        Link for your partner
      </label>
      <div className="flex gap-2">
        <input
          id="invite-link"
          className="field mono min-w-0 flex-1 text-[12px]"
          value={url}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
        />
        <button type="button" className="btn btn-outline h-11 flex-none text-[12px]" onClick={copyLink}>
          Copy link
        </button>
      </div>
      {copy === "idle" ? null : (
        <p className={`text-[12px] ${copy === "copied" ? "text-good" : "text-bad"}`} role="status">
          {copy === "copied" ? "Link copied." : "The link could not be copied. Select it and copy it yourself."}
        </p>
      )}
    </div>
  );
}
