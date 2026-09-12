import { describe, expect, it } from "vitest";

import {
  FAN_MESSAGE_INTERVAL_MS,
  MAX_FAN_MESSAGE_LENGTH,
  blockedWord,
  checkFanMessage,
  fanCourtPath,
  fanInitials,
  fanName,
} from "@/lib/fan-chat";

const NOW = 1_700_000_000_000;
const ALLOWED = { body: "Great rally", muted: false, lastMessageAt: null, now: NOW };

describe("blockedWord", () => {
  it("finds a blocked word whatever the case and punctuation", () => {
    expect(blockedWord("What the FUCK, umpire?")).toBe("fuck");
    expect(blockedWord("chutiya!")).toBe("chutiya");
  });

  it("leaves a clean message alone, and does not match inside a longer word", () => {
    expect(blockedWord("That backhand was unreal")).toBeNull();
    expect(blockedWord("Shitake mushrooms at the stall")).toBeNull();
  });
});

describe("checkFanMessage", () => {
  it("allows a clean message from a fan who has not just posted", () => {
    expect(checkFanMessage(ALLOWED)).toEqual({ ok: true });
  });

  it("refuses an empty message, one that is too long, and blocked language", () => {
    expect(checkFanMessage({ ...ALLOWED, body: "   " })).toMatchObject({ ok: false });
    expect(checkFanMessage({ ...ALLOWED, body: "a".repeat(MAX_FAN_MESSAGE_LENGTH + 1) })).toMatchObject({
      ok: false,
    });
    expect(checkFanMessage({ ...ALLOWED, body: "you bastard" })).toEqual({
      ok: false,
      error: "That language is not allowed in the chat.",
    });
  });

  it("refuses a muted fan and one posting again too soon", () => {
    expect(checkFanMessage({ ...ALLOWED, muted: true })).toMatchObject({ ok: false });
    expect(checkFanMessage({ ...ALLOWED, lastMessageAt: NOW - 1_000 })).toEqual({
      ok: false,
      error: "Wait 4s before posting again.",
    });
  });

  it("allows the next message once the wait has passed", () => {
    expect(checkFanMessage({ ...ALLOWED, lastMessageAt: NOW - FAN_MESSAGE_INTERVAL_MS })).toEqual({
      ok: true,
    });
  });
});

describe("fan names", () => {
  it("shows a first name and a surname initial", () => {
    expect(fanName("Rhea Sharma", null)).toBe("Rhea S.");
    expect(fanName(null, "Arjun Kumar Nair")).toBe("Arjun N.");
    expect(fanName(null, "Meera")).toBe("Meera");
  });

  it("names a fan who signed in without a profile or an account name", () => {
    expect(fanName(null, null)).toBe("Fan");
    expect(fanName(null, "   ")).toBe("Fan");
  });

  it("makes initials, and falls back when there is no letter to use", () => {
    expect(fanInitials("Rhea S.")).toBe("RS");
    expect(fanInitials("Meera")).toBe("M");
    expect(fanInitials("")).toBe("?");
  });
});

describe("fanCourtPath", () => {
  it("links to a court", () => {
    expect(fanCourtPath(3)).toBe("/live/3");
  });
});
