import { describe, expect, it } from "vitest";

import { ageFromDob } from "@/lib/age";

const NOW = new Date(2026, 8, 11); // 11 Sep 2026 (local)

describe("ageFromDob", () => {
  it("computes age for a birthday already passed this year", () => {
    expect(ageFromDob("1990-03-15", NOW)).toBe(36);
  });

  it("subtracts one when the birthday is later this year", () => {
    expect(ageFromDob("1990-12-01", NOW)).toBe(35);
  });

  it("handles birthday on the reference day", () => {
    expect(ageFromDob("2007-09-11", NOW)).toBe(19);
  });

  it("handles month boundary (same month, earlier day)", () => {
    expect(ageFromDob("2000-09-01", NOW)).toBe(26);
  });

  it("handles month boundary (same month, later day)", () => {
    expect(ageFromDob("2000-09-20", NOW)).toBe(25);
  });

  it("returns null for malformed input", () => {
    expect(ageFromDob("not-a-date", NOW)).toBeNull();
    expect(ageFromDob("1990/03/15", NOW)).toBeNull();
    expect(ageFromDob("", NOW)).toBeNull();
  });

  it("returns null for impossible dates", () => {
    expect(ageFromDob("2025-02-30", NOW)).toBeNull();
  });

  it("returns null for future dates", () => {
    expect(ageFromDob("2030-01-01", NOW)).toBeNull();
  });
});
