import { describe, expect, it } from "vitest";

import { afterSignInPath, signInPathFor } from "@/lib/sign-in-return";

describe("afterSignInPath", () => {
  it("returns to a page on this site", () => {
    expect(afterSignInPath("/live/3")).toBe("/live/3");
    expect(afterSignInPath(" /draws/OS?tab=groups ")).toBe("/draws/OS?tab=groups");
  });

  it.each([
    ["nothing", ""],
    ["another site", "https://example.com"],
    ["a protocol-relative link", "//example.com"],
    ["a backslash trick", "/\\example.com"],
    ["a relative path", "live/3"],
  ])("goes home for %s", (_case, next) => {
    expect(afterSignInPath(next)).toBe("/home");
  });
});

describe("signInPathFor", () => {
  it("links to sign-in with the page to come back to", () => {
    expect(signInPathFor("/live/3")).toBe("/signin?next=%2Flive%2F3");
  });
});
