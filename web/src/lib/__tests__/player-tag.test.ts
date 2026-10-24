import { describe, expect, it } from "vitest";

import { playerTag, type EventStanding, type PlayedMatch } from "@/lib/player-tag";

const won = (sets: [number, number, boolean?][]): PlayedMatch => ({
  won: true,
  sets: sets.map(([mine, theirs, tiebreak]) => ({ mine, theirs, tiebreak: tiebreak ?? false })),
});
const lost = (sets: [number, number, boolean?][]): PlayedMatch => ({ ...won(sets), won: false });
const standing = (label: string): EventStanding => ({ category: "S40", label });

describe("playerTag", () => {
  it("names the champion and the runner-up with their event", () => {
    expect(playerTag([standing("Winner")], [])).toMatchObject({ kind: "champion", title: "Champion", line: "Top of the 40+ singles draw. Take a bow." });
    expect(playerTag([standing("Runner-up")], []).kind).toBe("finalist");
  });

  it("speaks of a run still going while the event is on", () => {
    expect(playerTag([standing("Advanced from Semi-finals")], []).kind).toBe("intoFinal");
    expect(playerTag([standing("Advanced from Quarter-finals")], []).kind).toBe("intoSemis");
    expect(playerTag([standing("Reached Semi-finals")], []).kind).toBe("semiFinalist");
    expect(playerTag([standing("Through from Group A")], []).kind).toBe("knockouts");
  });

  it("takes the best run when a player has more than one event", () => {
    expect(playerTag([standing("Out in Group B"), { category: "D40", label: "Winner" }], []).line).toContain("40+ doubles");
  });

  it("praises how they won when no knockout run counts", () => {
    expect(playerTag([standing("Playing Group A")], [won([[6, 2]]), won([[6, 4]])])).toMatchObject({ kind: "unbeaten", line: "2 matches played, 2 won." });
    expect(playerTag([], [won([[6, 0]]), lost([[3, 6]])]).kind).toBe("bagel");
    expect(playerTag([], [won([[7, 6, true]]), lost([[2, 6]])]).kind).toBe("tiebreak");
    expect(playerTag([], [won([[4, 6], [6, 3], [10, 8, true]]), lost([[2, 6]])]).kind).toBe("tiebreak");
    expect(playerTag([], [won([[4, 6], [6, 3], [6, 4]]), lost([[2, 6]])]).kind).toBe("comeback");
    expect(playerTag([], [won([[6, 4]]), lost([[2, 6]])])).toMatchObject({ kind: "winner", line: "Won a match at the Rubsta Open." });
  });

  it("never counts a 6–0 or a tiebreak the player lost", () => {
    expect(playerTag([], [won([[6, 3]]), lost([[0, 6]]), lost([[6, 7, true]])]).kind).toBe("winner");
  });

  it("thanks a player who lost every match, and never names an exit", () => {
    const tag = playerTag([standing("Out in Group A")], [lost([[2, 6]]), lost([[4, 6]])]);

    expect(tag.kind).toBe("fighter");
    expect(`${tag.title} ${tag.line}`).not.toMatch(/out|lost/i);
  });

  it("welcomes a player with no matches played, such as one with only walkovers", () => {
    expect(playerTag([standing("Awaiting match")], []).kind).toBe("ready");
  });
});
