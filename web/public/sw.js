/*
 * Service worker for the umpire scoring pages, registered with scope /score.
 *
 * Network first, so an online visit always gets a fresh page. Each good
 * response is kept, so a scoring page opened once still loads with no signal.
 * Before keeping a page, the worker keeps every app file its HTML refers to:
 * a full page load can need files that a client-side visit never fetched.
 * Scores live in the page's localStorage; this worker keeps only pages and
 * app files. A page that loaded before the worker took control asks it to keep
 * that page and its files (src/app/(scoring)/offline-support.tsx).
 *
 * CACHE_PREFIX must match OFFLINE_CACHE_PREFIX in src/lib/offline-pages.ts.
 * Change CACHE_VERSION to drop every kept page and file on the next visit.
 */

const CACHE_PREFIX = "tournament-os-scoring-";
const CACHE_VERSION = "v1";
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;
const SCOPE_PATH = "/score";
const APP_FILES_PATH = "/_next/";
const CACHE_URLS_MESSAGE = "cache-urls";
/** App file paths in a page's HTML: script and style tags, and the inline React payload. */
const APP_FILE_REFERENCE = /\/_next\/[^"'\\\s<>()]+/g;
/** A page slower than this comes from the cache, when one is kept. */
const NAVIGATION_TIMEOUT_MS = 5000;
const OFFLINE_STATUS = 503;

const OFFLINE_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>No connection · Scoring</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: #f6f8fb; color: #0b1620; }
  main { max-width: 28rem; margin: 0 auto; padding: 40px 20px; }
  h1 { margin: 0 0 12px; font-size: 20px; }
  p { font-size: 14px; line-height: 1.5; color: #46586a; }
  a { color: #2f698e; font-weight: 600; }
</style>
</head>
<body>
<main>
  <h1>No connection</h1>
  <p>This page has not been opened on this phone yet, so it cannot load without a connection.</p>
  <p>Scores already entered on this phone are safe. Connect and try again.</p>
  <p><a href="">Try again</a></p>
</main>
</body>
</html>`;

class NavigationTimeoutError extends Error {}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isScoringPage(url) {
  return (
    isSameOrigin(url) && (url.pathname === SCOPE_PATH || url.pathname.startsWith(SCOPE_PATH + "/"))
  );
}

function isAppFile(url) {
  return isSameOrigin(url) && url.pathname.startsWith(APP_FILES_PATH);
}

/** Pages are kept by path, so a query string never hides a kept page. */
function pageKey(url) {
  return url.origin + url.pathname;
}

/**
 * App files are kept under one spelling of their path. HTML can name a file
 * "[turbopack]_x.js" while the browser requests "%5Bturbopack%5D_x.js".
 */
function fileKey(url) {
  let pathname = url.pathname;
  try {
    pathname = encodeURI(decodeURI(url.pathname));
  } catch {
    // A malformed escape cannot be respelled; keep the path as requested.
  }
  return url.origin + pathname + url.search;
}

function isKeepablePage(response) {
  const contentType = response.headers.get("Content-Type") || "";
  return response.ok && !response.redirected && contentType.includes("text/html");
}

function isKeepableFile(response) {
  return response.ok && !response.redirected;
}

function warnNotKept(url, error) {
  console.warn("Could not keep " + url + " for use without a connection.", error);
}

async function keep(key, response) {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(key, response);
  } catch (error) {
    warnNotKept(key, error);
  }
}

async function kept(key) {
  const cache = await caches.open(CACHE_NAME);
  return cache.match(key, { ignoreVary: true });
}

async function keepFile(url) {
  const key = fileKey(url);
  // A built app file never changes under the same URL, so a kept one is enough.
  if (await kept(key)) return;
  try {
    const response = await fetch(url.href, { credentials: "same-origin" });
    if (isKeepableFile(response)) await keep(key, response);
  } catch (error) {
    warnNotKept(url.href, error);
  }
}

/** Keeps the files a page refers to first, so a kept page always has what it needs. */
async function keepPage(url, response) {
  const html = await response.clone().text();
  const paths = new Set(html.match(APP_FILE_REFERENCE) || []);
  for (const path of paths) {
    await keepFile(new URL(path, self.location.origin));
  }
  await keep(pageKey(url), response);
}

async function keepPageFromNetwork(url) {
  try {
    const response = await fetch(url.href, { credentials: "same-origin" });
    if (isKeepablePage(response)) await keepPage(url, response);
  } catch (error) {
    warnNotKept(url.href, error);
  }
}

async function keepUrls(urls) {
  for (const raw of urls) {
    const url = new URL(raw, self.location.origin);
    if (isScoringPage(url)) {
      await keepPageFromNetwork(url);
    } else if (isAppFile(url)) {
      await keepFile(url);
    }
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new NavigationTimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function offlinePage() {
  return new Response(OFFLINE_PAGE, {
    status: OFFLINE_STATUS,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

async function respondToPage(event) {
  const url = new URL(event.request.url);
  const network = fetch(event.request).then((response) => {
    if (isKeepablePage(response)) event.waitUntil(keepPage(url, response.clone()));
    return response;
  });
  // Keeps the worker alive until a slow page arrives and is kept.
  event.waitUntil(network.catch(() => undefined));

  try {
    return await withTimeout(network, NAVIGATION_TIMEOUT_MS);
  } catch (error) {
    const page = await kept(pageKey(url));
    if (page) return page;
    if (error instanceof NavigationTimeoutError) {
      // Nothing kept: a slow page still beats the offline notice.
      return network.catch(() => offlinePage());
    }
    return offlinePage();
  }
}

async function respondToAppFile(event) {
  const { request } = event;
  const key = fileKey(new URL(request.url));
  try {
    const response = await fetch(request);
    if (isKeepableFile(response)) event.waitUntil(keep(key, response.clone()));
    return response;
  } catch (error) {
    const file = await kept(key);
    if (file) return file;
    throw error;
  }
}

async function activate() {
  const names = await caches.keys();
  const outdated = names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME);
  await Promise.all(outdated.map((name) => caches.delete(name)));
  await self.clients.claim();
}

self.addEventListener("install", () => {
  // Network first never serves a stale page online, so a new worker can take over at once.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(activate());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (request.mode === "navigate" && isScoringPage(url)) {
    event.respondWith(respondToPage(event));
  } else if (isAppFile(url)) {
    event.respondWith(respondToAppFile(event));
  }
});

self.addEventListener("message", (event) => {
  const { data } = event;
  if (!data || data.type !== CACHE_URLS_MESSAGE || !Array.isArray(data.urls)) return;
  event.waitUntil(keepUrls(data.urls));
});
