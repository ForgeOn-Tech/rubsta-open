import { describe, expect, it } from "vitest";

import { OFFLINE_CACHE_PREFIX, clearOfflinePages, offlineCacheUrls } from "@/lib/offline-pages";

const ORIGIN = "https://scores.example";

describe("offlineCacheUrls", () => {
  it("lists the page, then each same-origin app file once", () => {
    const loaded = [
      `${ORIGIN}/_next/static/chunks/app.js`,
      `${ORIGIN}/_next/static/chunks/app.js`,
      `${ORIGIN}/_next/static/css/app.css`,
      `${ORIGIN}/api/matches/m1/score`,
      `${ORIGIN}/score/m1?_rsc=abc`,
      "https://fonts.googleapis.com/css2?family=Inter",
    ];

    expect(offlineCacheUrls(`${ORIGIN}/score/m1`, loaded, ORIGIN)).toEqual([
      `${ORIGIN}/score/m1`,
      `${ORIGIN}/_next/static/chunks/app.js`,
      `${ORIGIN}/_next/static/css/app.css`,
    ]);
  });

  it("lists only the page when nothing else was loaded", () => {
    expect(offlineCacheUrls(`${ORIGIN}/score`, [], ORIGIN)).toEqual([`${ORIGIN}/score`]);
  });
});

describe("clearOfflinePages", () => {
  it("deletes the scoring caches and leaves any other cache", async () => {
    const names = new Set([`${OFFLINE_CACHE_PREFIX}v1`, `${OFFLINE_CACHE_PREFIX}v0`, "another-app"]);
    const storage = {
      keys: async () => [...names],
      delete: async (name: string) => names.delete(name),
    };

    await clearOfflinePages(storage);

    expect([...names]).toEqual(["another-app"]);
  });
});
