// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SEED_TOURNAMENT } from "@/db/seed";
import { entriesOpen } from "@/lib/entries";

describe("public registration deadline", () => {
  it("closes at midnight IST at the end of 22 October 2026", () => {
    expect(SEED_TOURNAMENT.entryClosesAt).toBe("2026-10-23T00:00:00+05:30");
    expect(entriesOpen(SEED_TOURNAMENT, new Date("2026-10-22T23:59:59+05:30"))).toBe(true);
    expect(entriesOpen(SEED_TOURNAMENT, new Date("2026-10-23T00:00:01+05:30"))).toBe(false);
  });
});
