import { describe, expect, it } from "vitest";
import { comboPartner, registrationOption, registrationPrice, topUpPrice } from "@/lib/registration-pricing";

const fees = { OS: 300000, OD: 400000, S40: 300000, W30: 250000, U15: 200000 };

describe("registration pricing", () => {
  it("offers only the agreed combinations", () => {
    expect(registrationOption("OS_OD")?.categories).toEqual(["OS", "OD"]);
    expect(registrationOption("S40_OD")?.categories).toEqual(["S40", "OD"]);
    expect(registrationOption("W30_OD")?.categories).toEqual(["W30", "OD"]);
    expect(registrationOption("OS_W30")).toBeNull();
  });

  it("takes ₹200 off one event and ₹500 off an approved combo before October", () => {
    const before = new Date("2026-09-30T23:59:59+05:30");
    expect(registrationPrice(fees, ["OS"], before)).toBe(280000);
    expect(registrationPrice(fees, ["OS", "OD"], before)).toBe(650000);
    expect(registrationPrice(fees, ["S40", "OD"], before)).toBe(650000);
    expect(registrationPrice(fees, ["W30", "OD"], before)).toBe(600000);
  });

  it("uses standard prices from 1 October", () => {
    expect(registrationPrice(fees, ["W30"], new Date("2026-10-01T00:00:00+05:30"))).toBe(250000);
    expect(registrationPrice(fees, ["W30", "OD"], new Date("2026-10-01T00:00:00+05:30"))).toBe(650000);
  });
});

describe("comboPartner", () => {
  it("finds the paid event that forms an approved combo with the new one", () => {
    expect(comboPartner("OD", ["OS"])).toBe("OS");
    expect(comboPartner("OS", ["W30", "OD"])).toBe("OD");
  });

  it("returns null when no paid event forms an approved combo", () => {
    expect(comboPartner("W30", ["OS"])).toBeNull();
    expect(comboPartner("OD", [])).toBeNull();
    expect(comboPartner("OD", ["OD"])).toBeNull();
  });
});

describe("topUpPrice", () => {
  const before = new Date("2026-09-30T12:00:00+05:30");
  const after = new Date("2026-10-01T00:00:00+05:30");

  it("charges the early-bird combo price less the single already paid", () => {
    // OS + OD combo ₹6,500 less ₹2,800 paid for OS.
    expect(topUpPrice(fees, "OS", "OD", 280000, before)).toBe(370000);
  });

  it("never charges more than the single price once early bird ends", () => {
    // Combo ₹7,000 less ₹2,800 is ₹4,200, above the ₹4,000 single price.
    expect(topUpPrice(fees, "OS", "OD", 280000, after)).toBe(400000);
  });

  it("never goes below zero", () => {
    expect(topUpPrice(fees, "OS", "OD", 900000, before)).toBe(0);
  });
});
