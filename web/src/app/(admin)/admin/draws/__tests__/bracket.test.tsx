import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Bracket } from "../bracket";
import { buildBracket, type DrawLine } from "@/lib/draws";

const LINES: DrawLine[] = [
  { position: 1, entryId: "gp", seed: 1 },
  { position: 2, entryId: null, seed: null },
  { position: 3, entryId: "am", seed: null },
  { position: 4, entryId: "rs", seed: 2 },
];

const LABELS = new Map([
  ["gp", "Gaurav Pillai"],
  ["am", "Arjun Mehta"],
  ["rs", "Riya Singh / Meera Iyer"],
]);

describe("Bracket", () => {
  it("shows each round with its matches", () => {
    render(<Bracket rounds={buildBracket(LINES)} labels={LABELS} />);

    expect(screen.getByText("Semi-finals")).toBeInTheDocument();
    expect(screen.getByText("Final")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem", { name: /^Match \d$/ })).toHaveLength(3);
  });

  it("shows names, seeds, byes and winner placeholders", () => {
    render(<Bracket rounds={buildBracket(LINES)} labels={LABELS} />);

    const first = screen.getByRole("listitem", { name: "Match 1" });
    expect(within(first).getByText("Gaurav Pillai")).toBeInTheDocument();
    expect(within(first).getByText("1")).toBeInTheDocument();
    expect(within(first).getByText("Bye")).toBeInTheDocument();

    const final = screen.getByRole("listitem", { name: "Match 3" });
    expect(within(final).getByText("Gaurav Pillai")).toBeInTheDocument();
    expect(within(final).getByText("Winner M2")).toBeInTheDocument();
  });
});
