import { describe, expect, it } from "vitest";

import { minutesOf } from "@/lib/auto-schedule";
import { dropTime, gridRange, slotStarts } from "@/lib/schedule-grid";

const span = (start: string, end: string) => ({ start: minutesOf(start), end: minutesOf(end) });

describe("gridRange", () => {
  it("shows 08:00 to 20:00 for an empty day", () => {
    expect(gridRange([])).toEqual({ from: minutesOf("08:00"), to: minutesOf("20:00") });
  });

  it("starts at the hour of an early first match and leaves two hours after the last", () => {
    expect(gridRange([span("07:30", "08:15"), span("19:15", "20:45")])).toEqual({
      from: minutesOf("07:00"),
      to: minutesOf("23:00"),
    });
  });

  it("stops before midnight", () => {
    expect(gridRange([span("21:00", "23:30")]).to).toBe(minutesOf("23:45"));
  });
});

describe("slotStarts", () => {
  it("steps every 15 minutes up to the end", () => {
    expect(slotStarts({ from: minutesOf("08:00"), to: minutesOf("09:00") })).toEqual(
      ["08:00", "08:15", "08:30", "08:45"].map(minutesOf),
    );
  });
});

describe("dropTime", () => {
  const range = { from: minutesOf("08:00"), to: minutesOf("20:00") };

  it("snaps to the nearest slot", () => {
    expect(dropTime(range, 37)).toBe(minutesOf("08:30"));
    expect(dropTime(range, 38)).toBe(minutesOf("08:45"));
  });

  it("keeps a drop above or below the grid inside it", () => {
    expect(dropTime(range, -50)).toBe(minutesOf("08:00"));
    expect(dropTime(range, 2000)).toBe(minutesOf("19:45"));
  });
});
