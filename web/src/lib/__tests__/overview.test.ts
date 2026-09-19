import { describe, expect, it } from "vitest";

import { isActiveNavItem } from "@/lib/admin-nav";
import { summariseByEvent, timeToCloseLabel } from "@/lib/overview";

describe("summariseByEvent", () => {
  it("lists every event even with no entries", () => {
    const summary = summariseByEvent([]);

    expect(summary.map((row) => row.category)).toEqual(["OS", "W30", "U15", "OD", "S40"]);
    expect(summary.every((row) => row.active === 0 && row.accepted === 0)).toBe(true);
  });

  it("separates awaiting review, accepted and cancelled entries", () => {
    const summary = summariseByEvent([
      { category: "OS", status: "submitted" },
      { category: "OS", status: "confirmed" },
      { category: "OS", status: "paid" },
      { category: "OS", status: "cancelled" },
      { category: "OD", status: "paid" },
    ]);

    expect(summary[0]).toEqual({
      category: "OS",
      label: "Open singles",
      active: 3,
      awaitingReview: 1,
      accepted: 2,
    });
    expect(summary[3].accepted).toBe(1);
  });
});

describe("timeToCloseLabel", () => {
  const CLOSES_AT = "2026-09-22T18:00:00+05:30";

  it("counts days when more than two days remain", () => {
    expect(timeToCloseLabel(CLOSES_AT, new Date("2026-09-11T18:00:00+05:30"))).toBe(
      "Closes in 11 days",
    );
  });

  it("counts hours inside the last two days", () => {
    expect(timeToCloseLabel(CLOSES_AT, new Date("2026-09-22T13:00:00+05:30"))).toBe(
      "Closes in 5 hours",
    );
    expect(timeToCloseLabel(CLOSES_AT, new Date("2026-09-22T16:30:00+05:30"))).toBe(
      "Closes in 1 hour",
    );
  });

  it("handles the final hour and the deadline itself", () => {
    expect(timeToCloseLabel(CLOSES_AT, new Date("2026-09-22T17:30:00+05:30"))).toBe(
      "Closes in under an hour",
    );
    expect(timeToCloseLabel(CLOSES_AT, new Date("2026-09-22T18:00:00+05:30"))).toBe(
      "Entries closed",
    );
  });

  it("throws on an unreadable closing time", () => {
    expect(() => timeToCloseLabel("soon", new Date())).toThrow(/Invalid entry closing time/);
  });
});

describe("isActiveNavItem", () => {
  it("marks Overview active only on /admin itself", () => {
    expect(isActiveNavItem("/admin", "/admin")).toBe(true);
    expect(isActiveNavItem("/admin/entries", "/admin")).toBe(false);
  });

  it("keeps a section active on its sub-pages", () => {
    expect(isActiveNavItem("/admin/entries", "/admin/entries")).toBe(true);
    expect(isActiveNavItem("/admin/entries/abc", "/admin/entries")).toBe(true);
    expect(isActiveNavItem("/admin/entries-archive", "/admin/entries")).toBe(false);
  });
});
