import { venueDay } from "./schedule";

/** A partner shown beside the court streams on one day. */
export interface StreamSponsor {
  name: string;
  logo: string;
}

export const STREAM_SPONSOR_LABEL = "In association with";

/** Each tournament day's stream partner, by venue date. */
const STREAM_SPONSORS_BY_DAY: Readonly<Record<string, StreamSponsor>> = {
  "2026-10-24": { name: "Heartfull", logo: "/sponsors/heartfull.png" },
  "2026-10-25": { name: "Team Leader", logo: "/sponsors/team-leader.png" },
};

/** The stream partner for the venue day at `epochMs`, or null on a day without one. */
export function streamSponsorAt(epochMs: number): StreamSponsor | null {
  return STREAM_SPONSORS_BY_DAY[venueDay(epochMs)] ?? null;
}

/** Today's stream partner at the venue. */
export function todaysStreamSponsor(): StreamSponsor | null {
  return streamSponsorAt(Date.now());
}
