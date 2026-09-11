import { describe, expect, it } from "vitest";

import {
  CATEGORY_LABELS,
  countByStatus,
  entriesClosed,
  isDoubles,
  isUniqueViolation,
  parseStatusFilter,
  validateEntryInput,
} from "@/lib/entries";

const CLOSES_AT = "2026-09-22T18:00:00+05:30";
const BEFORE_CLOSE = new Date("2026-09-11T00:00:00+05:30");
const AFTER_CLOSE = new Date("2026-09-23T00:00:00+05:30");

const base = {
  category: "MS",
  existingCategories: [] as string[],
  entryClosesAt: CLOSES_AT,
  tournamentStatus: "open" as const,
  now: BEFORE_CLOSE,
};

describe("category labels", () => {
  it("maps every category to a display label", () => {
    expect(CATEGORY_LABELS.MS).toBe("Men's singles");
    expect(CATEGORY_LABELS.WS).toBe("Women's singles");
    expect(CATEGORY_LABELS.MD).toBe("Men's doubles");
    expect(CATEGORY_LABELS.WD).toBe("Women's doubles");
  });
});

describe("isDoubles", () => {
  it("is true only for MD and WD", () => {
    expect(isDoubles("MD")).toBe(true);
    expect(isDoubles("WD")).toBe(true);
    expect(isDoubles("MS")).toBe(false);
    expect(isDoubles("WS")).toBe(false);
  });
});

describe("entriesClosed", () => {
  it("is open before the deadline", () => {
    expect(entriesClosed(CLOSES_AT, BEFORE_CLOSE)).toBe(false);
  });

  it("is closed after the deadline", () => {
    expect(entriesClosed(CLOSES_AT, AFTER_CLOSE)).toBe(true);
  });
});

describe("validateEntryInput", () => {
  it("accepts a singles entry before the deadline", () => {
    expect(validateEntryInput(base)).toEqual({ ok: true, category: "MS" });
  });

  it("requires a partner for men's doubles", () => {
    const result = validateEntryInput({ ...base, category: "MD" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/partner name and email/i);
    }
  });

  it("requires a partner for women's doubles", () => {
    const result = validateEntryInput({
      ...base,
      category: "WD",
      partnerName: "  ",
      partnerEmail: "partner@example.com",
    });
    expect(result.ok).toBe(false);
  });

  it("accepts doubles with a partner name and valid email", () => {
    const result = validateEntryInput({
      ...base,
      category: "MD",
      partnerName: "Rahul Verma",
      partnerEmail: "rahul@example.com",
    });
    expect(result).toEqual({ ok: true, category: "MD" });
  });

  it("rejects an invalid partner email", () => {
    const result = validateEntryInput({
      ...base,
      category: "WD",
      partnerName: "Riya Singh",
      partnerEmail: "not-an-email",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/valid partner email/i);
  });

  it("rejects a duplicate entry in the same category", () => {
    const result = validateEntryInput({
      ...base,
      existingCategories: ["MS"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("You already have a Men's singles entry.");
    }
  });

  it("allows entries in other categories when one exists", () => {
    const result = validateEntryInput({
      ...base,
      category: "MD",
      partnerName: "Rahul Verma",
      partnerEmail: "rahul@example.com",
      existingCategories: ["MS"],
    });
    expect(result).toEqual({ ok: true, category: "MD" });
  });

  it("blocks submission after entries close", () => {
    const result = validateEntryInput({ ...base, now: AFTER_CLOSE });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Entries are closed.");
  });

  it("blocks submission when the organiser has closed the tournament", () => {
    const result = validateEntryInput({ ...base, tournamentStatus: "closed" });
    expect(result).toEqual({ ok: false, error: "Entries are closed." });
  });

  it("rejects unknown categories", () => {
    const result = validateEntryInput({ ...base, category: "XD" });
    expect(result.ok).toBe(false);
  });
});

describe("countByStatus", () => {
  it("returns zero for every status when there are no entries", () => {
    expect(countByStatus([])).toEqual({
      submitted: 0,
      confirmed: 0,
      paid: 0,
      cancelled: 0,
    });
  });

  it("counts each status separately", () => {
    expect(countByStatus(["submitted", "paid", "submitted", "cancelled"])).toEqual({
      submitted: 2,
      confirmed: 0,
      paid: 1,
      cancelled: 1,
    });
  });
});

describe("parseStatusFilter", () => {
  it("accepts a known status", () => {
    expect(parseStatusFilter("paid")).toBe("paid");
  });

  it("shows all entries for a missing or unknown status", () => {
    expect(parseStatusFilter(undefined)).toBeNull();
    expect(parseStatusFilter("")).toBeNull();
    expect(parseStatusFilter("refunded")).toBeNull();
  });
});

describe("isUniqueViolation", () => {
  function sqliteError(code: string): Error {
    return Object.assign(new Error("constraint failed"), { code });
  }

  it("detects a raw SQLite unique violation", () => {
    expect(isUniqueViolation(sqliteError("SQLITE_CONSTRAINT_UNIQUE"))).toBe(true);
  });

  it("detects a unique violation wrapped as the error cause", () => {
    const wrapped = new Error("Failed query", {
      cause: sqliteError("SQLITE_CONSTRAINT_UNIQUE"),
    });
    expect(isUniqueViolation(wrapped)).toBe(true);
  });

  it("ignores other constraint errors and non-errors", () => {
    expect(isUniqueViolation(sqliteError("SQLITE_CONSTRAINT_FOREIGNKEY"))).toBe(false);
    expect(isUniqueViolation(new Error("disk full"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation("SQLITE_CONSTRAINT_UNIQUE")).toBe(false);
  });
});
