import { describe, expect, it } from "vitest";

import { csvCell, fileSlug, toCsv } from "@/lib/csv";

describe("csvCell", () => {
  it("leaves plain text alone and blanks null", () => {
    expect(csvCell("Men's singles")).toBe("Men's singles");
    expect(csvCell(1500)).toBe("1500");
    expect(csvCell(null)).toBe("");
  });

  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell("11 Sept 2026, 09:30")).toBe('"11 Sept 2026, 09:30"');
    expect(csvCell('The "Rocket"')).toBe('"The ""Rocket"""');
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
  });

  it("neutralises values a spreadsheet would run as a formula", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("-2+3+cmd")).toBe("'-2+3+cmd");
  });

  it("keeps phone numbers and signed numbers as typed", () => {
    expect(csvCell("+91 98765 43210")).toBe("+91 98765 43210");
    expect(csvCell("-12.5")).toBe("-12.5");
  });
});

describe("toCsv", () => {
  it("joins cells with commas and rows with CRLF", () => {
    expect(toCsv([["a", "b"], ["c, d", null]])).toBe('a,b\r\n"c, d",\r\n');
  });
});

describe("fileSlug", () => {
  it("builds a lowercase hyphenated name", () => {
    expect(fileSlug("Rubsta Open 2026")).toBe("rubsta-open-2026");
    expect(fileSlug("  Autumn — Open! ")).toBe("autumn-open");
  });
});
