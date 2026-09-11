import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlayerCard, type PlayerCardProps } from "../player-card";

const PROFILE: PlayerCardProps["profile"] = {
  fullName: "Gaurav Pillai",
  dateOfBirth: "2007-03-14",
  club: "Deccan Gymkhana",
  bestRanking: "State 24",
  previousTournaments: [
    { name: "Monsoon Hardcourt Open", year: 2026, result: "Semi-final" },
    { name: "City Championship", year: 2025, result: "Winner" },
  ],
};

function statValue(label: string): HTMLElement {
  const term = screen.getByText(label, { selector: "dt" });
  return within(term.parentElement as HTMLElement).getByRole("definition");
}

describe("PlayerCard", () => {
  it("shows the data the profile records", () => {
    render(<PlayerCard profile={PROFILE} entryCount={2} />);

    expect(screen.getByText("Gaurav Pillai")).toBeInTheDocument();
    expect(screen.getByText(/Deccan Gymkhana/)).toBeInTheDocument();
    expect(statValue("Best ranking")).toHaveTextContent("State 24");
    expect(statValue("Events entered")).toHaveTextContent("2");
    expect(screen.getByText("Monsoon Hardcourt Open")).toBeInTheDocument();
    expect(screen.getByText("Winner")).toBeInTheDocument();
  });

  it("marks stats without data as coming soon", () => {
    render(<PlayerCard profile={PROFILE} entryCount={0} />);

    for (const label of ["Matches", "Win–loss", "Player ID", "Plays"]) {
      expect(statValue(label)).toHaveTextContent("Coming soon");
    }
  });

  it("shows certificate and share actions as disabled", () => {
    render(<PlayerCard profile={PROFILE} entryCount={0} />);

    expect(
      screen.getByRole("button", { name: "Participation certificate · Coming soon" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Share card · Coming soon" })).toBeDisabled();
  });

  it("says when optional fields are empty", () => {
    render(
      <PlayerCard
        profile={{ ...PROFILE, bestRanking: null, previousTournaments: [] }}
        entryCount={0}
      />,
    );

    expect(statValue("Best ranking")).toHaveTextContent("Not added");
    expect(screen.getByText("No previous tournaments added.")).toBeInTheDocument();
  });
});
