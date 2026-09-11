import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlayerCard, type PlayerCardProps } from "../player-card";

const PROFILE: PlayerCardProps["profile"] = {
  fullName: "Gaurav Pillai",
  dateOfBirth: "2007-03-14",
  club: "Deccan Gymkhana",
  bestRanking: "State 24",
  plays: "right",
  previousTournaments: [
    { name: "Monsoon Hardcourt Open", year: 2026, result: "Semi-final" },
    { name: "City Championship", year: 2025, result: "Winner" },
  ],
};
const NO_MATCHES = { played: 0, won: 0, lost: 0 };

function statValue(label: string): HTMLElement {
  const term = screen.getByText(label, { selector: "dt" });
  return within(term.parentElement as HTMLElement).getByRole("definition");
}

describe("PlayerCard", () => {
  it("shows the data the profile records", () => {
    render(<PlayerCard profile={PROFILE} playerId="FL-2026-0117" entryCount={2} record={NO_MATCHES} />);

    expect(screen.getByText("Gaurav Pillai")).toBeInTheDocument();
    expect(screen.getByText(/Right-handed · Deccan Gymkhana/)).toBeInTheDocument();
    expect(statValue("Best ranking")).toHaveTextContent("State 24");
    expect(statValue("Events entered")).toHaveTextContent("2");
    expect(statValue("Player ID")).toHaveTextContent("FL-2026-0117");
    expect(statValue("Plays")).toHaveTextContent("Right-handed");
    expect(screen.getByText("Monsoon Hardcourt Open")).toBeInTheDocument();
    expect(screen.getByText("Winner")).toBeInTheDocument();
  });

  it("shows the match record from saved scores", () => {
    render(
      <PlayerCard profile={PROFILE} playerId="FL-2026-0117" entryCount={2} record={{ played: 5, won: 3, lost: 2 }} />,
    );

    expect(statValue("Matches")).toHaveTextContent("5");
    expect(statValue("Win–loss")).toHaveTextContent("3–2");
  });

  it("shows certificate and share actions as disabled", () => {
    render(<PlayerCard profile={PROFILE} playerId={null} entryCount={0} record={NO_MATCHES} />);

    expect(
      screen.getByRole("button", { name: "Participation certificate · Coming soon" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Share card · Coming soon" })).toBeDisabled();
  });

  it("says when optional fields are empty", () => {
    render(
      <PlayerCard
        profile={{ ...PROFILE, bestRanking: null, plays: null, previousTournaments: [] }}
        playerId={null}
        entryCount={0}
        record={NO_MATCHES}
      />,
    );

    expect(statValue("Best ranking")).toHaveTextContent("Not added");
    expect(statValue("Plays")).toHaveTextContent("Not added");
    expect(statValue("Player ID")).toHaveTextContent("Not assigned");
    expect(statValue("Win–loss")).toHaveTextContent("0–0");
    expect(screen.getByText("No previous tournaments added.")).toBeInTheDocument();
  });
});
