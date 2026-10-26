import { describe, expect, it } from "vitest";
import { tournamentEnded } from "@/lib/tournament";
import { nextStep } from "@/lib/home";

describe("completed tournament", () => {
  it("ends after the final day in India, not at the start of that day", () => {
    const event = { endsOn: "2026-10-25" };
    expect(tournamentEnded(event, new Date("2026-10-25T23:59:59+05:30"))).toBe(false);
    expect(tournamentEnded(event, new Date("2026-10-26T00:00:00+05:30"))).toBe(true);
    expect(tournamentEnded({ endsOn: null })).toBe(false);
    expect(tournamentEnded({ endsOn: "invalid" })).toBe(false);
  });
  it("replaces registration and payment prompts with results after the event", () => {
    for (const registrationPaid of [true, false]) {
      const step = nextStep({ endsOn: "2000-01-01", registrationPaid, pendingEntryId: "pending", hasProfile: false, entriesOpen: true, enteredCount: 0, categoryCount: 6 });
      expect(step.kind).toBe("tournament-ended");
      expect(step.action).toEqual({ label: "View results", href: "/results" });
    }
  });
});
