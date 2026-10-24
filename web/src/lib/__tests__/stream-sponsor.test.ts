import { describe, expect, it } from "vitest";

import { streamSponsorAt } from "@/lib/stream-sponsor";

describe("streamSponsorAt", () => {
  it("shows Heartfull on the first day and Team Leader on the second", () => {
    expect(streamSponsorAt(Date.parse("2026-10-24T09:00:00+05:30"))?.name).toBe("Heartfull");
    expect(streamSponsorAt(Date.parse("2026-10-25T09:00:00+05:30"))?.name).toBe("Team Leader");
  });

  it("changes partner at midnight in India, not in UTC", () => {
    // 00:30 on 25 Oct in India is still 24 Oct in UTC.
    expect(streamSponsorAt(Date.parse("2026-10-25T00:30:00+05:30"))?.name).toBe("Team Leader");
    expect(streamSponsorAt(Date.parse("2026-10-24T23:59:00+05:30"))?.name).toBe("Heartfull");
  });

  it("shows no partner outside the tournament days", () => {
    expect(streamSponsorAt(Date.parse("2026-10-23T12:00:00+05:30"))).toBeNull();
    expect(streamSponsorAt(Date.parse("2026-10-26T12:00:00+05:30"))).toBeNull();
  });
});
