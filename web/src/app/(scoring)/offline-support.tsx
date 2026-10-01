"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  CACHE_URLS_MESSAGE,
  SCORING_SCOPE,
  SERVICE_WORKER_URL,
  offlineCacheUrls,
} from "@/lib/offline-pages";

/**
 * Registers the scoring service worker (public/sw.js). The worker keeps each
 * page it serves, but it never sees a page that loaded before it took control,
 * nor one reached by client-side navigation. After each of those, this asks
 * the worker to keep the current page and the app files loaded so far.
 */
export function OfflineSupport() {
  const pathname = usePathname();
  const firstRun = useRef(true);

  useEffect(() => {
    // Browsers offer service workers only on HTTPS and localhost.
    if (!("serviceWorker" in navigator)) return;
    const workers = navigator.serviceWorker;
    const keptAsItLoaded = firstRun.current && workers.controller !== null;
    firstRun.current = false;
    let cancelled = false;

    workers
      .register(SERVICE_WORKER_URL, { scope: SCORING_SCOPE })
      .then(() => workers.ready)
      .then((registration) => {
        if (cancelled || keptAsItLoaded || registration.active === null) return;
        const loaded = performance.getEntriesByType("resource").map((entry) => entry.name);
        registration.active.postMessage({
          type: CACHE_URLS_MESSAGE,
          urls: offlineCacheUrls(window.location.href, loaded, window.location.origin),
        });
      })
      .catch((error: unknown) => {
        console.warn("Scoring pages will not open offline: the service worker did not register.", error);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
