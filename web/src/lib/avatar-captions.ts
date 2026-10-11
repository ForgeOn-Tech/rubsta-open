const OPENERS = [
  "Small avatar.", "Fresh strings.", "Game face on.", "A little court magic.",
  "Racket ready.", "Meet my court-side self.", "Tiny me, big dreams.", "Made for match day.",
  "One more rally.", "All smiles, all game.", "Serving a little personality.", "A new spin on me.",
  "My happy place? The court.", "Good vibes, clean lines.", "From portrait to player.", "A little ace energy.",
] as const;
const MIDDLES = [
  "Big baseline energy.", "Here for the good rallies.", "Bringing my own spin.", "Chasing the next point.",
  "Powered by a love of tennis.", "Ready for a little friendly competition.", "Every point is a fresh start.", "Making room for one more set.",
  "A soft spot for a sharp volley.", "Keeping the game playful.", "A backhand and a big smile.", "A little bounce goes a long way.",
  "Good company, great tennis.", "Putting heart into every swing.", "Taking the scenic route to match point.", "One swing closer to my best.",
] as const;
const ENDINGS = [
  "See you on court.", "Let’s rally.", "Your serve.", "Game on.",
  "Meet me at the baseline.", "Love the game.", "See you at Rubsta.", "Let the good sets roll.",
] as const;

export const AVATAR_CAPTION_COUNT = OPENERS.length * MIDDLES.length * ENDINGS.length;
const STORAGE_KEY = "rubsta-avatar-caption-history-v1";
const memoryHistory = new Set<number>();

export function avatarCaptionAt(index: number): string {
  const ending = index % ENDINGS.length;
  const middle = Math.floor(index / ENDINGS.length) % MIDDLES.length;
  const opener = Math.floor(index / (ENDINGS.length * MIDDLES.length));
  return `${OPENERS[opener]} ${MIDDLES[middle]} ${ENDINGS[ending]}`;
}

/** A random unseen suggestion; history contains only numbers, never player data. */
export function suggestAvatarCaption(): string {
  let storage: Storage | undefined;
  try {
    storage = window.localStorage;
    const saved: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? "[]");
    if (Array.isArray(saved)) for (const id of saved) {
      if (Number.isInteger(id) && id >= 0 && id < AVATAR_CAPTION_COUNT) memoryHistory.add(id);
    }
  } catch { /* Suggestions still work for this visit when storage is unavailable. */ }
  const start = Math.floor(Math.random() * AVATAR_CAPTION_COUNT);
  for (let offset = 0; offset < AVATAR_CAPTION_COUNT; offset += 1) {
    const id = (start + offset) % AVATAR_CAPTION_COUNT;
    if (memoryHistory.has(id)) continue;
    memoryHistory.add(id);
    try { storage?.setItem(STORAGE_KEY, JSON.stringify([...memoryHistory])); } catch { /* Use memory history. */ }
    return avatarCaptionAt(id);
  }
  throw new Error("You’ve explored every caption suggestion. Make the next one your own!");
}
