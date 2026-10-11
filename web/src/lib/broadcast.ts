import { streamEmbedUrl } from "./stream";

export const BROADCAST_STATUSES = ["off", "scheduled", "live", "ended"] as const;
export type BroadcastStatus = typeof BROADCAST_STATUSES[number];
export const BROADCAST_LABELS: Record<BroadcastStatus, string> = {
  off: "No broadcast", scheduled: "Starting soon", live: "Live", ended: "Ended",
};
export interface BroadcastSettings {
  status: BroadcastStatus;
  streamUrl: string | null;
  replayUrl: string | null;
}
export interface PublicBroadcast {
  status: BroadcastStatus;
  embedUrl: string | null;
  watchUrl: string | null;
  replay: boolean;
}

/** Keep only the public video address, never a pasted token or other query fields. */
export function videoUrl(value: string): string | null {
  if (!value.trim()) return null;
  if (value.length > 2048) throw new Error("The video link is too long.");
  const embed = streamEmbedUrl(value);
  if (!embed) throw new Error("Paste a YouTube video or live link. Do not paste a stream key.");
  return `https://www.youtube.com/watch?v=${embed.split("/").at(-1)}`;
}

export function validateBroadcast(input: { status: string; streamUrl: string; replayUrl: string }): BroadcastSettings {
  const status = BROADCAST_STATUSES.find(option => option === input.status);
  if (!status) throw new Error("Choose a broadcast status.");
  const streamUrl = videoUrl(input.streamUrl);
  const replayUrl = videoUrl(input.replayUrl);
  if ((status === "scheduled" || status === "live") && !streamUrl) {
    throw new Error("Add a YouTube stream link before choosing Starting soon or Live.");
  }
  return { status, streamUrl, replayUrl };
}

export function publicBroadcast(settings: BroadcastSettings): PublicBroadcast {
  const replay = settings.status === "ended" && settings.replayUrl !== null;
  const url = replay ? settings.replayUrl : settings.status === "scheduled" || settings.status === "live" ? settings.streamUrl : null;
  const embedUrl = streamEmbedUrl(url);
  return { status: settings.status, embedUrl, watchUrl: embedUrl ? `https://www.youtube.com/watch?v=${embedUrl.split("/").at(-1)}` : null, replay: replay && embedUrl !== null };
}
