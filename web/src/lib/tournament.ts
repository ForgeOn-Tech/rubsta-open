/**
 * Shown next to the fee and closing time on player pages until an organiser
 * ticks "Schedule confirmed" in /admin/settings.
 */
export const PROVISIONAL_SCHEDULE_NOTE =
  "The entry fee and closing time are provisional until the organisers confirm them.";

/** The event finishes at the end of its final day in India. */
export function tournamentEnded(tournament: { endsOn?: string | null }, now = new Date()): boolean {
  if (!tournament.endsOn) return false;
  const finalDay = new Date(`${tournament.endsOn}T00:00:00+05:30`).getTime();
  return Number.isFinite(finalDay) && now.getTime() >= finalDay + 24 * 60 * 60 * 1000;
}
