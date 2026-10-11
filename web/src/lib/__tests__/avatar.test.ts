import { describe, expect, it } from "vitest";
import { avatarAccessError, avatarPhotoError, avatarQuote, AVATAR_MAX_BYTES, AVATAR_PROFILE_REQUIRED } from "../avatar";

describe("avatar safeguards", () => {
  it("only unlocks for paid adult players", () => {
    expect(avatarAccessError(18, true)).toBeNull();
    expect(avatarAccessError(17, true)).toContain("Junior registration is unaffected");
    expect(avatarAccessError(null, true)).toBe(AVATAR_PROFILE_REQUIRED);
    expect(avatarAccessError(null, false)).toBe(AVATAR_PROFILE_REQUIRED);
    expect(avatarAccessError(30, false)).toBeTruthy();
  });
  it("bounds upload size and disallows SVG or unknown types", () => {
    expect(avatarPhotoError(100, "image/jpeg")).toBeNull();
    expect(avatarPhotoError(0, "image/png")).toBeTruthy();
    expect(avatarPhotoError(AVATAR_MAX_BYTES + 1, "image/png")).toBeTruthy();
    expect(avatarPhotoError(100, "image/svg+xml")).toBeTruthy();
  });
  it("bounds and normalizes quotes", () => {
    expect(avatarQuote(" ")).toBe("See you on court.");
    expect(avatarQuote("a".repeat(200))).toHaveLength(100);
    expect(avatarQuote("hello\nworld")).toBe("hello world");
  });
});
