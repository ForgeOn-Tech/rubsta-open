import type { Check } from "@/lib/partners";

export const FAN_LIVE_PATH = "/live";
export const FAN_LEADERBOARD_PATH = "/live/leaderboard";
export const ADMIN_FAN_PATH = "/admin/fan";

export const MAX_FAN_MESSAGE_LENGTH = 200;
/** One message every five seconds, so a single fan cannot fill the court chat. */
export const FAN_MESSAGE_INTERVAL_MS = 5_000;
/** How many messages a court chat shows. */
export const FAN_MESSAGE_LIMIT = 50;

const FALLBACK_FAN_NAME = "Fan";
const SECOND_MS = 1_000;

/**
 * Words a message may not contain. The list catches the obvious cases only:
 * hiding a message and muting the fan are what an admin relies on.
 */
const BLOCKED_WORDS: readonly string[] = [
  "fuck",
  "shit",
  "bitch",
  "bastard",
  "cunt",
  "slut",
  "whore",
  "chutiya",
  "madarchod",
  "behenchod",
  "gandu",
  "randi",
];

const WORDS = /[\p{L}\p{N}]+/gu;

/** The court a fan is watching. */
export function fanCourtPath(courtNumber: number): string {
  return `${FAN_LIVE_PATH}/${courtNumber}`;
}

/** The first blocked word in a message, or null when it has none. */
export function blockedWord(body: string): string | null {
  const words = body.toLowerCase().match(WORDS) ?? [];
  return words.find((word) => BLOCKED_WORDS.includes(word)) ?? null;
}

/** Whether a fan may post this message now. */
export function checkFanMessage(input: {
  body: string;
  muted: boolean;
  lastMessageAt: number | null;
  now: number;
}): Check {
  const { body, muted, lastMessageAt, now } = input;
  if (muted) return { ok: false, error: "You cannot post in the chat. Ask the organisers." };

  const trimmed = body.trim();
  if (trimmed === "") return { ok: false, error: "Write a message first." };
  if (trimmed.length > MAX_FAN_MESSAGE_LENGTH) {
    return { ok: false, error: `Keep it to ${MAX_FAN_MESSAGE_LENGTH} characters.` };
  }
  if (blockedWord(trimmed) !== null) {
    return { ok: false, error: "That language is not allowed in the chat." };
  }
  if (lastMessageAt !== null && now - lastMessageAt < FAN_MESSAGE_INTERVAL_MS) {
    const seconds = Math.ceil((FAN_MESSAGE_INTERVAL_MS - (now - lastMessageAt)) / SECOND_MS);
    return { ok: false, error: `Wait ${seconds}s before posting again.` };
  }
  return { ok: true };
}

/**
 * How a fan appears in the chat: a first name and a surname initial, as in
 * "Rhea S.". Fans who signed in without a profile may have no name at all.
 */
export function fanName(profileName: string | null, accountName: string | null): string {
  const parts = (profileName ?? accountName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return FALLBACK_FAN_NAME;
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/** One or two letters for the chat avatar, or "?" when the fan has no name. */
export function fanInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.replace(/[^\p{L}\p{N}]/gu, "").toUpperCase() || "?";
}
