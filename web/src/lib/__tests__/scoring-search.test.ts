import { describe, expect, it } from "vitest";

import { cardMatchesSearch, filterMatchGroups, type MatchCardView, type MatchGroupView } from "@/lib/scoring-search";

function card(id: string, overrides: Partial<MatchCardView>): MatchCardView {
  return {
    id,
    heading: "M2 · Open singles · Group A",
    court: "Court 1",
    top: "Caheer Warik",
    bottom: "Vihaan Jain",
    summary: null,
    place: "Sat 24 Oct · Court 1 · 10:00",
    linked: true,
    ...overrides,
  };
}

const M2 = card("m2", {});
const M23 = card("m23", {
  heading: "M23 · Open singles · Quarter-finals",
  top: "Group A winner",
  bottom: "Group H winner",
});
const M5 = card("m5", { heading: "M5 · Women's 30+ · Group", court: "Court 3", top: "Mayuka Takai", bottom: "Shalja Kumar" });

describe("cardMatchesSearch", () => {
  it("finds a match by part of a player's name, in any case", () => {
    expect(cardMatchesSearch(M2, "vihaan")).toBe(true);
    expect(cardMatchesSearch(M2, "WARIK")).toBe(true);
    expect(cardMatchesSearch(M2, "kumar")).toBe(false);
  });

  it("finds a match by number, event and court", () => {
    expect(cardMatchesSearch(M23, "m23")).toBe(true);
    expect(cardMatchesSearch(M5, "women")).toBe(true);
    expect(cardMatchesSearch(M5, "court 3")).toBe(true);
    expect(cardMatchesSearch(M2, "court 3")).toBe(false);
  });

  it("matches the start of a word, so a court number does not find other matches", () => {
    const m13 = card("m13", { heading: "M13 · Open singles · Group C", court: "Court 2" });

    expect(cardMatchesSearch(m13, "court 3")).toBe(false);
    expect(cardMatchesSearch(m13, "m1")).toBe(true);
    expect(cardMatchesSearch(M2, "aan")).toBe(false);
  });

  it("needs every word to fit", () => {
    expect(cardMatchesSearch(M2, "jain court 1")).toBe(true);
    expect(cardMatchesSearch(M2, "jain court 4")).toBe(false);
  });

  it("keeps every match for an empty or blank search", () => {
    expect(cardMatchesSearch(M2, "")).toBe(true);
    expect(cardMatchesSearch(M2, "   ")).toBe(true);
  });
});

describe("filterMatchGroups", () => {
  const groups: MatchGroupView[] = [
    { id: "ready", title: "Ready to start", cards: [M2, M5] },
    { id: "waiting", title: "Waiting on earlier results", cards: [M23] },
  ];

  it("keeps only fitting matches and drops groups left empty", () => {
    expect(filterMatchGroups(groups, "takai")).toEqual([{ id: "ready", title: "Ready to start", cards: [M5] }]);
  });

  it("returns nothing when no match fits", () => {
    expect(filterMatchGroups(groups, "federer")).toEqual([]);
  });

  it("leaves the groups as they were for an empty search", () => {
    expect(filterMatchGroups(groups, "")).toEqual(groups);
  });
});
