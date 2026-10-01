// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SEED_TOURNAMENT } from "@/db/seed";
import { entriesOpen } from "@/lib/entries";

describe("public registration deadline", () => {
  it("closes on 15 October 2026 at the retained 18:00 IST cutoff", () => {
    expect(SEED_TOURNAMENT.entryClosesAt).toBe("2026-10-15T18:00:00+05:30");
    expect(entriesOpen(SEED_TOURNAMENT, new Date("2026-10-15T17:59:59+05:30"))).toBe(true);
    expect(entriesOpen(SEED_TOURNAMENT, new Date("2026-10-15T18:00:01+05:30"))).toBe(false);
  });
});
