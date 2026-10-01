import { describe, expect, it } from "vitest";

import {
  isCalendarDate,
  isoToIstLocal,
  istLocalToIso,
  validateSettings,
  type SettingsForm,
} from "@/lib/settings";

const VALID: SettingsForm = {
  name: "Rubsta Open 2026",
  startsOn: "2026-09-25",
  endsOn: "2026-09-27",
  venue: "Deccan Gymkhana, Pune",
  entryClosesAt: "2026-09-22T18:00",
  feeRupees: { OS: "3000", W30: "2500", U15: "2000", OD: "4000", S40: "3000" },
  status: "open",
  scheduleConfirmed: true,
};

function errorFor(overrides: Partial<SettingsForm>): string | null {
  const result = validateSettings({ ...VALID, ...overrides });
  return result.ok ? null : result.error;
}

describe("validateSettings", () => {
  it("returns table values for a complete form", () => {
    expect(validateSettings(VALID)).toEqual({
      ok: true,
      settings: {
        name: "Rubsta Open 2026",
        startsOn: "2026-09-25",
        endsOn: "2026-09-27",
        venue: "Deccan Gymkhana, Pune",
        entryClosesAt: "2026-09-22T18:00:00+05:30",
        status: "open",
        scheduleConfirmed: true,
      },
      fees: { OS: 300000, W30: 250000, U15: 200000, OD: 400000, S40: 300000 },
    });
  });

  it("stores blank optional fields as null while the schedule is unconfirmed", () => {
    const result = validateSettings({
      ...VALID,
      startsOn: " ",
      endsOn: "",
      venue: "",
      scheduleConfirmed: false,
    });

    expect(result.ok && result.settings).toMatchObject({ startsOn: null, endsOn: null, venue: null });
  });

  it("requires a name", () => {
    expect(errorFor({ name: "   " })).toBe("Tournament name is required.");
  });

  it("checks the date range", () => {
    expect(errorFor({ startsOn: "2026-02-30" })).toBe("Enter a valid start date.");
    expect(errorFor({ startsOn: "", scheduleConfirmed: false })).toBe(
      "Add a start date before an end date.",
    );
    expect(errorFor({ endsOn: "2026-09-24" })).toBe(
      "The end date must be on or after the start date.",
    );
    expect(errorFor({ endsOn: "2026-09-25" })).toBeNull();
  });

  it("requires entries to close by the start date", () => {
    expect(errorFor({ entryClosesAt: "2026-09-26T09:00" })).toBe(
      "Entries must close on or before the start date.",
    );
    expect(errorFor({ entryClosesAt: "2026-09-25T09:00" })).toBeNull();
    expect(errorFor({ entryClosesAt: "22/09/2026 18:00" })).toBe(
      "Enter a valid entry closing time.",
    );
  });

  it("takes each event's fee in whole rupees", () => {
    const fee = (category: keyof SettingsForm["feeRupees"], value: string) =>
      errorFor({ feeRupees: { ...VALID.feeRupees, [category]: value } });

    expect(fee("OD", "1500.50")).toBe("Enter the Open doubles fee in whole rupees.");
    expect(fee("U15", "-5")).toBe("Enter the U-15 juniors fee in whole rupees.");
    expect(fee("W30", " ")).toBe("Enter the Women's 30+ fee in whole rupees.");
    expect(fee("OS", "0")).toBeNull();
    expect(fee("S40", "1000001")).toBe("The 40+ singles fee is too large.");
  });

  it("rejects an unknown status", () => {
    expect(errorFor({ status: "paused" })).toBe("Choose whether entries are open or closed.");
  });

  it("needs a start date and venue to confirm the schedule", () => {
    expect(errorFor({ venue: "" })).toBe(
      "Add a start date and venue before confirming the schedule.",
    );
  });
});

describe("IST date-time conversion", () => {
  it("turns a datetime-local value into a stored IST timestamp", () => {
    expect(istLocalToIso("2026-09-22T18:00")).toBe("2026-09-22T18:00:00+05:30");
    expect(istLocalToIso("2026-09-22T24:00")).toBeNull();
    expect(istLocalToIso("2026-02-30T10:00")).toBeNull();
  });

  it("turns a stored timestamp back into IST form input, whatever its offset", () => {
    expect(isoToIstLocal("2026-09-22T18:00:00+05:30")).toBe("2026-09-22T18:00");
    expect(isoToIstLocal("2026-09-22T12:30:00Z")).toBe("2026-09-22T18:00");
  });

  it("throws on an unreadable stored time", () => {
    expect(() => isoToIstLocal("later")).toThrow(/Invalid tournament time/);
  });
});

describe("isCalendarDate", () => {
  it("accepts leap days only in leap years", () => {
    expect(isCalendarDate("2028-02-29")).toBe(true);
    expect(isCalendarDate("2026-02-29")).toBe(false);
  });
});
