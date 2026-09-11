import { describe, expect, it } from "vitest";

import type { Profile } from "@/db/schema";
import {
  buildPlayerRows,
  matchesPlayerSearch,
  parseSearchQuery,
  type PlayerAccount,
} from "@/lib/players";

function profile(fullName: string, club: string | null, mobile: string): Profile {
  return {
    id: `profile-${fullName}`,
    userId: `user-${fullName}`,
    fullName,
    dateOfBirth: "2004-05-17",
    gender: "male",
    mobile,
    club,
    bestRanking: null,
    previousTournaments: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

const ZARA: PlayerAccount = {
  userId: "u-zara",
  email: "zara@example.com",
  accountName: "Zara",
  profile: profile("Zara Khan", "Deccan Gymkhana", "+91 90000 11111"),
};
const ARJUN: PlayerAccount = {
  userId: "u-arjun",
  email: "arjun@example.com",
  accountName: null,
  profile: profile("Arjun Mehta", null, "+91 98888 22222"),
};
const ENTRANT_WITHOUT_PROFILE: PlayerAccount = {
  userId: "u-legacy",
  email: "legacy@example.com",
  accountName: "Legacy Player",
  profile: null,
};
const ADMIN_ONLY: PlayerAccount = {
  userId: "u-admin",
  email: "organiser@example.com",
  accountName: "Organiser",
  profile: null,
};

const ENTRIES = [
  { id: "e1", userId: "u-zara", category: "WS" as const, status: "paid" as const },
  { id: "e2", userId: "u-zara", category: "WD" as const, status: "submitted" as const },
  { id: "e3", userId: "u-legacy", category: "MS" as const, status: "cancelled" as const },
];

describe("buildPlayerRows", () => {
  const rows = buildPlayerRows([ZARA, ADMIN_ONLY, ARJUN, ENTRANT_WITHOUT_PROFILE], ENTRIES);

  it("keeps accounts with a profile or an entry, sorted by name", () => {
    expect(rows.map((row) => row.account.userId)).toEqual(["u-arjun", "u-legacy", "u-zara"]);
  });

  it("attaches each player's entries", () => {
    expect(rows.find((row) => row.account.userId === "u-zara")?.entries.map((e) => e.id)).toEqual([
      "e1",
      "e2",
    ]);
    expect(rows.find((row) => row.account.userId === "u-arjun")?.entries).toEqual([]);
  });
});

describe("matchesPlayerSearch", () => {
  const zara = { account: ZARA, entries: [] };

  it("matches name, email, club and mobile, ignoring case", () => {
    expect(matchesPlayerSearch(zara, "KHAN")).toBe(true);
    expect(matchesPlayerSearch(zara, "zara@")).toBe(true);
    expect(matchesPlayerSearch(zara, "gymkhana")).toBe(true);
    expect(matchesPlayerSearch(zara, "90000")).toBe(true);
  });

  it("matches everyone on an empty query and no one on a miss", () => {
    expect(matchesPlayerSearch(zara, "  ")).toBe(true);
    expect(matchesPlayerSearch(zara, "mehta")).toBe(false);
  });

  it("does not trip over a player without a profile", () => {
    expect(matchesPlayerSearch({ account: ENTRANT_WITHOUT_PROFILE, entries: [] }, "legacy")).toBe(
      true,
    );
    expect(matchesPlayerSearch({ account: ENTRANT_WITHOUT_PROFILE, entries: [] }, "club")).toBe(
      false,
    );
  });
});

describe("parseSearchQuery", () => {
  it("trims and caps the query", () => {
    expect(parseSearchQuery("  khan ")).toBe("khan");
    expect(parseSearchQuery(undefined)).toBe("");
    expect(parseSearchQuery("x".repeat(250))).toHaveLength(100);
  });
});
