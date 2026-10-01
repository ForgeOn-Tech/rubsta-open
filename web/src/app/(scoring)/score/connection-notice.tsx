"use client";

import { useSyncExternalStore } from "react";

function subscribeToConnection(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Warns that the match list may be an old copy while the phone has no connection. */
export function ConnectionNotice() {
  const online = useSyncExternalStore(
    subscribeToConnection,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <p className="card p-3 text-[13px] text-warn" style={{ borderColor: "var(--color-warn)" }} role="status">
      No connection. This list may be out of date. Scores you enter still stay on this phone.
    </p>
  );
}
