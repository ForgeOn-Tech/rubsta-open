/** Where the scoring service worker lives, and the pages it controls. See public/sw.js. */
export const SERVICE_WORKER_URL = "/sw.js";
export const SCORING_SCOPE = "/score";

/** Must match CACHE_PREFIX in public/sw.js. */
export const OFFLINE_CACHE_PREFIX = "tournament-os-scoring-";
export const CACHE_URLS_MESSAGE = "cache-urls";

const APP_FILES_PATH = "/_next/";

/** The current page, then each same-origin app file it loaded, for the worker to keep. */
export function offlineCacheUrls(
  pageUrl: string,
  loadedUrls: readonly string[],
  origin: string,
): string[] {
  const appFiles = loadedUrls.filter((raw) => {
    const url = new URL(raw);
    return url.origin === origin && url.pathname.startsWith(APP_FILES_PATH);
  });
  return [pageUrl, ...new Set(appFiles)];
}

/**
 * Deletes the pages and files the scoring worker kept, so the next person to
 * sign in on a shared phone cannot open them offline. Scores kept in
 * localStorage stay: they may not have reached the server yet.
 */
export async function clearOfflinePages(
  cacheStorage: Pick<CacheStorage, "keys" | "delete">,
): Promise<void> {
  const names = await cacheStorage.keys();
  await Promise.all(
    names
      .filter((name) => name.startsWith(OFFLINE_CACHE_PREFIX))
      .map((name) => cacheStorage.delete(name)),
  );
}
