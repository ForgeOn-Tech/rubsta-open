"use client";

import { useEffect } from "react";

import { clearOfflinePages } from "@/lib/offline-pages";

/** Drops scoring pages kept for offline use, so a shared phone does not show them to the next person. */
export function ClearOfflinePages() {
  useEffect(() => {
    // Cache Storage exists only on HTTPS and localhost.
    if (typeof caches === "undefined") return;
    clearOfflinePages(caches).catch((error: unknown) => {
      console.warn("Could not clear the scoring pages kept for offline use.", error);
    });
  }, []);
  return null;
}
