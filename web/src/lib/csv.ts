export type CsvValue = string | number | null;

// Spreadsheet apps run cells that start with these characters as formulas.
const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"] as const;
// Phone numbers and signed numbers cannot form a formula, so they stay as typed.
const PLAIN_NUMBER = /^[+-]?[\d\s().-]+$/;
const NEEDS_QUOTES = /[",\r\n]/;

/** One CSV cell: formula-guarded, then quoted per RFC 4180 when needed. */
export function csvCell(value: CsvValue): string {
  const text = value === null ? "" : String(value);
  const risky =
    FORMULA_PREFIXES.some((prefix) => text.startsWith(prefix)) && !PLAIN_NUMBER.test(text);
  const guarded = risky ? `'${text}` : text;
  return NEEDS_QUOTES.test(guarded) ? `"${guarded.replaceAll('"', '""')}"` : guarded;
}

/** Rows joined with CRLF, ending with a line break. */
export function toCsv(rows: readonly (readonly CsvValue[])[]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** "Rubsta Open 2026" → "rubsta-open-2026", for download file names. */
export function fileSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
