/** The order-of-play grid: courts across, time down, in steps of SLOT_MINUTES. */
export const SLOT_MINUTES = 15;
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
