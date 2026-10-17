import { describe, expect, it } from "vitest";

import {
  MAX_UMPIRE_NAME_LENGTH,
  isLinkActive,
  isUmpireLinkEmail,
  newUmpireToken,
  umpireEmailFor,
  umpireLinkPath,
  validateUmpireName,
} from "@/lib/umpire-links";

describe("validateUmpireName", () => {
  it("trims a name", () => {
    expect(validateUmpireName("  Ravi Kumar ")).toEqual({ ok: true, name: "Ravi Kumar" });
  });

  it.each([
    ["a blank name", "   ", "Enter the umpire's name."],
    ["a name that is too long", "x".repeat(MAX_UMPIRE_NAME_LENGTH + 1), `Keep the name to ${MAX_UMPIRE_NAME_LENGTH} characters.`],
  ])("refuses %s", (_case, raw, error) => {
    expect(validateUmpireName(raw)).toEqual({ ok: false, error });
  });
});

describe("isLinkActive", () => {
  const live = { revokedAt: null };

  it("works until revoked", () => {
    expect(isLinkActive(live, "2026-10-25", "2026-10-24")).toBe(true);
    expect(isLinkActive({ revokedAt: 1 }, "2026-10-25", "2026-10-24")).toBe(false);
  });

  it("works through the last day and lapses the day after", () => {
    expect(isLinkActive(live, "2026-10-25", "2026-10-25")).toBe(true);
    expect(isLinkActive(live, "2026-10-25", "2026-10-26")).toBe(false);
  });

  it("never lapses while the tournament has no end date", () => {
    expect(isLinkActive(live, null, "2030-01-01")).toBe(true);
  });
});

describe("link identity", () => {
  it("gives each link its own made-up email on a domain that never delivers", () => {
    expect(umpireEmailFor("ABC-123")).toBe("umpire-abc-123@rubstaopen.invalid");
  });

  it("recognises a link account's email and nobody else's", () => {
    expect(isUmpireLinkEmail(umpireEmailFor("abc"))).toBe(true);
    expect(isUmpireLinkEmail("umpire-abc@example.com")).toBe(false);
    expect(isUmpireLinkEmail("admin-password@rubstaopen.invalid")).toBe(false);
  });

  it("makes long, URL-safe and different secrets", () => {
    const first = newUmpireToken();

    expect(first).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(newUmpireToken()).not.toBe(first);
    expect(umpireLinkPath(first)).toBe(`/umpire/${first}`);
  });
});
