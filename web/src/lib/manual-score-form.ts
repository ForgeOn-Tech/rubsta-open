import type { PaperSet } from "./manual-score";

/** Best of three is the longest format, so a paper score has at most three sets. */
export const MAX_PAPER_SETS = 3;
const MAX_FIELD = 99;

export type PaperSetsResult = { ok: true; sets: PaperSet[] } | { ok: false; error: string };

/** The form field for one number of one set, e.g. "set1-top" or "set2-tiebreak-bottom". */
export function paperField(setNumber: number, part: "top" | "bottom" | "tiebreak-top" | "tiebreak-bottom"): string {
  return `set${setNumber}-${part}`;
}

function numberAt(formData: FormData, name: string): number | null | "bad" {
  const raw = String(formData.get(name) ?? "").trim();
  if (raw === "") return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value <= MAX_FIELD ? value : "bad";
}

/**
 * Reads the sets from the final-score form. A set with both boxes empty ends the score;
 * tiebreak points count only when both are filled in. Whether the score fits the match's
 * rules is checked later, against its format.
 */
export function paperSetsFrom(formData: FormData, maxSets: number): PaperSetsResult {
  const sets: PaperSet[] = [];
  for (let setNumber = 1; setNumber <= maxSets; setNumber += 1) {
    const top = numberAt(formData, paperField(setNumber, "top"));
    const bottom = numberAt(formData, paperField(setNumber, "bottom"));
    if (top === null && bottom === null) break;
    if (top === "bad" || bottom === "bad" || top === null || bottom === null) {
      return { ok: false, error: `Set ${setNumber}: enter both players' games as whole numbers.` };
    }
    const tiebreakTop = numberAt(formData, paperField(setNumber, "tiebreak-top"));
    const tiebreakBottom = numberAt(formData, paperField(setNumber, "tiebreak-bottom"));
    if (tiebreakTop === "bad" || tiebreakBottom === "bad") {
      return { ok: false, error: `Set ${setNumber}: tiebreak points must be whole numbers.` };
    }
    const tiebreak = tiebreakTop === null || tiebreakBottom === null ? null : { top: tiebreakTop, bottom: tiebreakBottom };
    sets.push({ top, bottom, tiebreak });
  }
  if (sets.length === 0) return { ok: false, error: "Enter the games for at least one set." };
  return { ok: true, sets };
}
