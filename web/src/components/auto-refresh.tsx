"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const MS_PER_SECOND = 1_000;

/** Reloads a server-rendered fan page on a timer, and only while it is on screen. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * MS_PER_SECOND);
    return () => window.clearInterval(timer);
  }, [router, seconds]);

  return null;
}
