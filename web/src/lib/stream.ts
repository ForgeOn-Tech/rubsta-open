import type { Check } from "@/lib/partners";

const YOUTUBE_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"];
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const EMBED_BASE = "https://www.youtube.com/embed/";
const WATCH_PATHS = ["/live/", "/embed/", "/v/"];

/** The video id in a YouTube watch, live, embed or youtu.be link, else null. */
function videoId(url: URL): string | null {
  if (url.hostname === "youtu.be") {
    const id = url.pathname.slice(1);
    return VIDEO_ID.test(id) ? id : null;
  }
  if (url.pathname === "/watch") {
    const id = url.searchParams.get("v") ?? "";
    return VIDEO_ID.test(id) ? id : null;
  }
  const path = WATCH_PATHS.find((prefix) => url.pathname.startsWith(prefix));
  if (path === undefined) return null;
  const id = url.pathname.slice(path.length);
  return VIDEO_ID.test(id) ? id : null;
}

/**
 * The player URL for a court's stream link, or null when the link is not a
 * YouTube video. Only this URL ever reaches the page, so an admin cannot put
 * another site in the Fan Zone frame.
 */
export function streamEmbedUrl(streamUrl: string | null): string | null {
  if (streamUrl === null || streamUrl.trim() === "") return null;
  let url: URL;
  try {
    url = new URL(streamUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !YOUTUBE_HOSTS.includes(url.hostname)) return null;
  const id = videoId(url);
  return id === null ? null : `${EMBED_BASE}${id}`;
}

/** Whether an admin's stream link can be shown. An empty link removes the stream. */
export function checkStreamUrl(value: string): Check {
  if (value.trim() === "") return { ok: true };
  if (streamEmbedUrl(value) === null) {
    return { ok: false, error: "Paste a YouTube link, such as https://www.youtube.com/watch?v=…" };
  }
  return { ok: true };
}
