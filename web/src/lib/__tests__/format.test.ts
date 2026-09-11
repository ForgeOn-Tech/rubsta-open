import { describe, expect, it } from "vitest";

import { formatTournamentDates } from "@/lib/format";

// Month abbreviations come from the runtime's en-GB locale data.
const SEPT = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(
  new Date(Date.UTC(2026, 8, 1)),
);

describe("formatTournamentDates", () => {
  it("is null without a start date", () => {
    expect(formatTournamentDates(null, null)).toBeNull();
    expect(formatTournamentDates(null, "2026-09-27")).toBeNull();
  });

  it("shows a single day when there is no end date or it matches the start", () => {
    expect(formatTournamentDates("2026-09-25", null)).toBe(`25 ${SEPT} 2026`);
    expect(formatTournamentDates("2026-09-25", "2026-09-25")).toBe(`25 ${SEPT} 2026`);
  });

  it("shares the month and year inside one month", () => {
    expect(formatTournamentDates("2026-09-25", "2026-09-27")).toBe(`25–27 ${SEPT} 2026`);
  });

  it("names both months across a month boundary", () => {
    expect(formatTournamentDates("2026-09-30", "2026-10-02")).toBe(`30 ${SEPT} – 2 Oct 2026`);
  });

  it("names both years across a year boundary", () => {
    expect(formatTournamentDates("2026-12-30", "2027-01-02")).toBe("30 Dec 2026 – 2 Jan 2027");
  });
});
