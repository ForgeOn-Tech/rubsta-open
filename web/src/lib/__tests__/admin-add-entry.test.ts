import { describe, expect, it } from "vitest";

import { validateAdminEntry, type RawAdminEntry, type RawPerson } from "@/lib/admin-add-entry";

const NOW = new Date("2026-10-24T09:00:00+05:30");
const PLAYER: RawPerson = {
  fullName: " Arjun Mehta ",
  email: "Arjun@Example.com ",
  dateOfBirth: "1999-03-14",
  gender: "male",
  mobile: " 9000000001 ",
  club: "  ",
};
const PARTNER: RawPerson = { ...PLAYER, fullName: "Rohan Kulkarni", email: "rohan@example.com", club: "MSLTA" };
const EMPTY: RawPerson = { fullName: "", email: "", dateOfBirth: "", gender: "", mobile: "", club: "" };

function entry(overrides: Partial<RawAdminEntry>): RawAdminEntry {
  return { category: "OS", status: "paid", player: PLAYER, partner: EMPTY, ...overrides };
}

describe("validateAdminEntry", () => {
  it("accepts a singles entry, tidies the details and ignores the empty partner", () => {
    // Act
    const result = validateAdminEntry(entry({}), NOW);

    // Assert
    expect(result).toEqual({
      ok: true,
      input: {
        category: "OS",
        status: "paid",
        player: { fullName: "Arjun Mehta", email: "arjun@example.com", dateOfBirth: "1999-03-14", gender: "male", mobile: "9000000001", club: null },
        partner: null,
      },
    });
  });

  it("accepts a doubles entry with the partner's details", () => {
    const result = validateAdminEntry(entry({ category: "OD", status: "confirmed", partner: PARTNER }), NOW);

    expect(result.ok && result.input.partner).toEqual({
      fullName: "Rohan Kulkarni", email: "rohan@example.com", dateOfBirth: "1999-03-14", gender: "male", mobile: "9000000001", club: "MSLTA",
    });
  });

  it.each([
    ["an unknown event", entry({ category: "XX" }), "Choose an event."],
    ["an unknown fee status", entry({ status: "submitted" }), "Choose whether the fee is paid."],
    ["a blank name", entry({ player: { ...PLAYER, fullName: " " } }), "Enter the player's full name."],
    ["a bad email", entry({ player: { ...PLAYER, email: "arjun" } }), "Enter a valid email for the player."],
    ["an impossible birth date", entry({ player: { ...PLAYER, dateOfBirth: "2001-02-30" } }), "Enter a valid date of birth for the player."],
    ["a missing gender", entry({ player: { ...PLAYER, gender: "" } }), "Choose the player's gender."],
    ["a blank mobile", entry({ player: { ...PLAYER, mobile: "" } }), "Enter the player's mobile number."],
    ["doubles without a partner", entry({ category: "D40" }), "Enter the partner's full name."],
    ["the player's own email as the partner's", entry({ category: "OD", partner: { ...PARTNER, email: "ARJUN@example.com" } }), "The player and partner need different emails."],
  ])("refuses %s", (_case, raw, error) => {
    expect(validateAdminEntry(raw, NOW)).toEqual({ ok: false, error });
  });
});
