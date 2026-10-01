import { describe, expect, it } from "vitest";

import {
  ENTRY_CSV_HEADER,
  entriesExportFilename,
  entrantLabel,
  entriesHref,
  entryCsvRows,
  filterEntries,
  parseCategoryFilter,
  playerName,
  type AdminEntryRow,
} from "@/lib/admin-entries";
import type { Category, EntryStatus } from "@/db/schema";

const CREATED_AT = Date.parse("2026-09-11T04:00:00Z");

function row(
  id: string,
  category: Category,
  status: EntryStatus,
  overrides: Partial<AdminEntryRow>,
): AdminEntryRow {
  return {
    entry: {
      id,
      userId: `user-${id}`,
      tournamentId: "tournament-1",
      category,
      division: "main",
      partnerName: null,
      partnerEmail: null,
      partnerStatus: null,
      partnerUserId: null,
      partnerRespondedAt: null,
      status,
      paymentRef: null,
      seed: null,
      createdAt: CREATED_AT,
    },
    email: `${id}@example.com`,
    accountName: null,
    profile: null,
    ...overrides,
  };
}

const ROWS: AdminEntryRow[] = [
  row("a", "MS", "submitted", {}),
  row("b", "MS", "paid", {}),
  row("c", "WD", "paid", {}),
];

describe("filterEntries", () => {
  it("returns everything without filters", () => {
    expect(filterEntries(ROWS, { status: null, category: null })).toHaveLength(3);
  });

  it("combines status and event filters", () => {
    const ids = (filters: Parameters<typeof filterEntries>[1]) =>
      filterEntries(ROWS, filters).map((item) => item.entry.id);

    expect(ids({ status: "paid", category: null })).toEqual(["b", "c"]);
    expect(ids({ status: null, category: "MS" })).toEqual(["a", "b"]);
    expect(ids({ status: "paid", category: "MS" })).toEqual(["b"]);
  });
});

describe("entriesHref", () => {
  it("omits empty filters", () => {
    expect(entriesHref("/admin/entries", { status: null, category: null })).toBe("/admin/entries");
    expect(entriesHref("/admin/entries", { status: "paid", category: null })).toBe(
      "/admin/entries?status=paid",
    );
  });

  it("carries both filters", () => {
    expect(entriesHref("/admin/entries/export", { status: "paid", category: "WD" })).toBe(
      "/admin/entries/export?category=WD&status=paid",
    );
  });
});

describe("parseCategoryFilter", () => {
  it("accepts known events only", () => {
    expect(parseCategoryFilter("MD")).toBe("MD");
    expect(parseCategoryFilter("XD")).toBeNull();
    expect(parseCategoryFilter(undefined)).toBeNull();
  });
});

describe("playerName", () => {
  it("prefers the profile name, then the account name, then the email", () => {
    const profile = { fullName: "Gaurav Pillai" } as AdminEntryRow["profile"];

    expect(playerName({ email: "g@example.com", accountName: "G", profile })).toBe("Gaurav Pillai");
    expect(playerName({ email: "g@example.com", accountName: "G", profile: null })).toBe("G");
    expect(playerName({ email: "g@example.com", accountName: null, profile: null })).toBe(
      "g@example.com",
    );
  });
});

describe("entriesExportFilename", () => {
  it("builds the file name from the tournament name", () => {
    expect(entriesExportFilename("Rubsta Open 2026")).toBe("rubsta-open-2026-entries.csv");
  });

  it("still names the file when the tournament name has no letters or digits", () => {
    expect(entriesExportFilename("— !?")).toBe("tournament-entries.csv");
  });
});

describe("entrantLabel", () => {
  it("adds the partner for doubles only", () => {
    const singles = row("s", "MS", "paid", { accountName: "Arjun Mehta" });
    const doubles = row("d", "WD", "paid", {
      accountName: "Riya Singh",
      entry: { ...ROWS[2].entry, partnerName: "Meera Iyer", partnerEmail: "meera@example.com" },
    });

    expect(entrantLabel(singles)).toBe("Arjun Mehta");
    expect(entrantLabel(doubles)).toBe("Riya Singh / Meera Iyer");
  });
});

describe("entryCsvRows", () => {
  it("starts with the header and maps a doubles entry", () => {
    const doubles = row("d", "WD", "paid", {
      accountName: "Riya Singh",
      entry: {
        ...ROWS[2].entry,
        id: "d",
        partnerName: "Meera Iyer",
        partnerEmail: "meera@example.com",
        paymentRef: "manual",
      },
    });

    const [header, first] = entryCsvRows([doubles]);

    expect(header).toEqual([...ENTRY_CSV_HEADER]);
    expect(first).toEqual([
      "d",
      "11 Sept 2026, 09:30",
      "Riya Singh",
      "d@example.com",
      null,
      null,
      null,
      null,
      "Women's doubles",
      "Meera Iyer",
      "meera@example.com",
      "Paid",
      "manual",
    ]);
  });
});
