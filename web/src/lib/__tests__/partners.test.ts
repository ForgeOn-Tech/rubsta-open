import { describe, expect, it } from "vitest";

import type { Entry } from "@/db/schema";
import {
  checkPartnerChange,
  checkPartnerResponse,
  normaliseEmail,
  partnerInvitationPath,
  partnerReady,
} from "@/lib/partners";

type InvitedEntry = Pick<Entry, "userId" | "category" | "status" | "partnerEmail" | "partnerStatus">;

const ENTRY: InvitedEntry = {
  userId: "inviter",
  category: "OD",
  status: "submitted",
  partnerEmail: "partner@example.com",
  partnerStatus: "pending",
};
const RESPONDER = { userId: "partner", email: " Partner@Example.com ", hasProfile: true };

function respond(overrides: {
  entry?: Partial<InvitedEntry>;
  responder?: Partial<typeof RESPONDER>;
  decision?: "accept" | "decline";
  playedCategories?: Entry["category"][];
}) {
  return checkPartnerResponse({
    entry: { ...ENTRY, ...overrides.entry },
    responder: { ...RESPONDER, ...overrides.responder },
    decision: overrides.decision ?? "accept",
    playedCategories: overrides.playedCategories ?? [],
  });
}

describe("partnerReady", () => {
  it("lets singles and accepted doubles into a draw, and holds the rest", () => {
    expect(partnerReady(null)).toBe(true);
    expect(partnerReady("accepted")).toBe(true);
    expect(partnerReady("pending")).toBe(false);
    expect(partnerReady("declined")).toBe(false);
  });
});

describe("normaliseEmail and partnerInvitationPath", () => {
  it("trims and lower-cases emails, and builds the invitation path", () => {
    expect(normaliseEmail(" A@B.com ")).toBe("a@b.com");
    expect(partnerInvitationPath("entry-1")).toBe("/partner/entry-1");
  });
});

describe("checkPartnerResponse", () => {
  it("lets the invited partner accept or decline, whatever the email's case", () => {
    expect(respond({})).toEqual({ ok: true });
    expect(respond({ decision: "decline" })).toEqual({ ok: true });
  });

  it("refuses anyone signed in with another email", () => {
    expect(respond({ responder: { email: "someone@example.com" } })).toEqual({
      ok: false,
      error: "This invitation is for a different email address.",
    });
  });

  it("refuses the player who made the entry", () => {
    expect(respond({ responder: { userId: "inviter" } }).ok).toBe(false);
  });

  it("refuses a singles entry, a cancelled entry and an answered invitation", () => {
    expect(respond({ entry: { partnerEmail: null, partnerStatus: null } }).ok).toBe(false);
    expect(respond({ entry: { status: "cancelled" } })).toEqual({
      ok: false,
      error: "This entry was cancelled.",
    });
    expect(respond({ entry: { partnerStatus: "declined" } })).toEqual({
      ok: false,
      error: "This invitation has already been answered.",
    });
  });

  it("needs a profile to accept, but not to decline", () => {
    expect(respond({ responder: { hasProfile: false } })).toEqual({
      ok: false,
      error: "Create your player profile before you accept.",
    });
    expect(respond({ responder: { hasProfile: false }, decision: "decline" })).toEqual({ ok: true });
  });

  it("refuses to accept an event the partner already plays", () => {
    expect(respond({ playedCategories: ["OD"] })).toEqual({
      ok: false,
      error: "You already play Open doubles, so you cannot accept.",
    });
    expect(respond({ playedCategories: ["OD"], decision: "decline" })).toEqual({ ok: true });
  });
});

describe("checkPartnerChange", () => {
  const change = {
    entry: { status: "submitted" as const, partnerStatus: "declined" as const },
    name: "Meera Iyer",
    email: "meera@example.com",
    ownEmail: "player@example.com",
    inPublishedDraw: false,
  };

  it("lets the player name a new partner after a decline or while waiting", () => {
    expect(checkPartnerChange(change)).toEqual({ ok: true });
    expect(checkPartnerChange({ ...change, entry: { ...change.entry, partnerStatus: "pending" } })).toEqual({
      ok: true,
    });
  });

  it("keeps an accepted partner and a drawn entry for the organisers to change", () => {
    expect(checkPartnerChange({ ...change, entry: { ...change.entry, partnerStatus: "accepted" } }).ok).toBe(
      false,
    );
    expect(checkPartnerChange({ ...change, inPublishedDraw: true }).ok).toBe(false);
  });

  it("checks the new partner's name and email", () => {
    expect(checkPartnerChange({ ...change, name: " " })).toEqual({
      ok: false,
      error: "Enter your partner's name.",
    });
    expect(checkPartnerChange({ ...change, email: "not-an-email" }).ok).toBe(false);
    expect(checkPartnerChange({ ...change, email: " Player@Example.com" })).toEqual({
      ok: false,
      error: "Enter your partner's email, not your own.",
    });
  });

  it("refuses singles and cancelled entries", () => {
    expect(checkPartnerChange({ ...change, entry: { status: "submitted", partnerStatus: null } }).ok).toBe(false);
    expect(checkPartnerChange({ ...change, entry: { ...change.entry, status: "cancelled" } }).ok).toBe(false);
  });
});
