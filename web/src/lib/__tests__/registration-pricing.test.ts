import { describe, expect, it } from "vitest";
import { registrationOption, registrationPrice } from "@/lib/registration-pricing";

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
