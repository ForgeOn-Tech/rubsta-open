/**
 * How many people have a court open in the Fan Zone. Presence is counted in
 * memory: it is worth nothing after a restart, and writing every poll to
 * SQLite would slow the umpires' saves down. One server holds one count, so
 * running `web` as several instances would undercount.
 */

/** A viewer drops out of the count this long after their last poll. */
export const VIEWER_TIMEOUT_MS = 30_000;
/** The id a page sends for itself, so one browser tab counts once. */
export const VIEWER_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

interface Viewer {
  courtNumber: number;
  lastSeenAt: number;
}

export interface Presence {
  /** Records that a tab is watching a court, and returns the court's count. */
  seen: (viewerId: string, courtNumber: number, now: number) => number;
  watching: (courtNumber: number, now: number) => number;
}

/** A presence counter of its own, for tests. */
export function createPresence(): Presence {
  const viewers = new Map<string, Viewer>();

  const prune = (now: number): void => {
    for (const [id, viewer] of viewers) {
      if (now - viewer.lastSeenAt >= VIEWER_TIMEOUT_MS) viewers.delete(id);
    }
  };

  const watching = (courtNumber: number, now: number): number => {
    prune(now);
    let count = 0;
    for (const viewer of viewers.values()) {
      if (viewer.courtNumber === courtNumber) count += 1;
    }
    return count;
  };

  return {
    seen: (viewerId, courtNumber, now) => {
      viewers.set(viewerId, { courtNumber, lastSeenAt: now });
      return watching(courtNumber, now);
    },
    watching,
  };
}

// One counter per server, kept across hot reloads as db/client.ts keeps its connection.
const globalForPresence = globalThis as unknown as { fanPresence?: Presence };

export function fanPresence(): Presence {
  if (!globalForPresence.fanPresence) {
    globalForPresence.fanPresence = createPresence();
  }
  return globalForPresence.fanPresence;
}
