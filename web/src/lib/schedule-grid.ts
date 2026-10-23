import type { Category } from "@/db/schema";

/** The order-of-play grid: courts across, time down, in steps of SLOT_MINUTES. */
export const SLOT_MINUTES = 15;

/**
 * Each event's colour on the grid, fixed so an event keeps its colour whatever else is on the
 * day. Checked on the card surface #faf8f1 for colour-blind separation. Red is left out, as it
 * means a clash. Three sit under 3:1 against the card, so every card also names its event.
 */
export const CATEGORY_COLORS: Record<Category, string> = {
  OS: "#2a78d6",
  W30: "#eb6834",
  U15: "#1baf7a",
  OD: "#eda100",
  S40: "#e87ba4",
  D40: "#008300",
};

const MINUTES_PER_HOUR = 60;
const LAST_MINUTE_OF_DAY = 24 * MINUTES_PER_HOUR;
/** An empty day shows 08:00 to 20:00. */
const EMPTY_DAY = { from: 8 * MINUTES_PER_HOUR, to: 20 * MINUTES_PER_HOUR };
/** Room below the last match to drop another after it. */
const ROOM_AFTER_MINUTES = 2 * MINUTES_PER_HOUR;

export interface GridRange {
  from: number;
  to: number;
}

/**
 * The hours the grid shows: from the hour of the first start to two hours past the last
 * finish, and never less than 08:00–20:00, so there is always room to drop a match.
 */
export function gridRange(spans: readonly { start: number; end: number }[]): GridRange {
  const from = Math.min(EMPTY_DAY.from, ...spans.map((span) => span.start));
  const to = Math.max(EMPTY_DAY.to, ...spans.map((span) => span.end + ROOM_AFTER_MINUTES));
  return {
    from: Math.floor(from / MINUTES_PER_HOUR) * MINUTES_PER_HOUR,
    to: Math.min(LAST_MINUTE_OF_DAY - SLOT_MINUTES, Math.ceil(to / MINUTES_PER_HOUR) * MINUTES_PER_HOUR),
  };
}

/** The start of each slot from `range.from` up to, not including, `range.to`. */
export function slotStarts(range: GridRange): number[] {
  return Array.from({ length: (range.to - range.from) / SLOT_MINUTES }, (_unused, index) => range.from + index * SLOT_MINUTES);
}

/** The slot a card dropped `offset` minutes below the grid's top starts in, kept inside the grid. */
export function dropTime(range: GridRange, offset: number): number {
  const slot = Math.round(offset / SLOT_MINUTES) * SLOT_MINUTES;
  return Math.min(range.to - SLOT_MINUTES, Math.max(range.from, range.from + slot));
}
