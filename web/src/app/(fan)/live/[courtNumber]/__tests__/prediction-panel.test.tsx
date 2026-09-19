import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PredictionPanel, type PredictionPanelProps } from "../prediction-panel";
import type { FanScoreboard } from "@/lib/fan-live";
import { PREDICTION_DISCLAIMER } from "@/lib/fan-predictions";
import { INITIAL_ACTION_STATE } from "@/lib/form-state";

const BOARD: FanScoreboard = {
  matchId: "match-1",
  matchNumber: 12,
  category: "OS",
  roundName: "Semi-finals",
  status: "in_progress",
  sides: {
    top: { name: "Y. Malhotra", seed: 1, sets: ["3"], point: "40", serving: true, winner: false },
    bottom: { name: "G. Pillai", seed: null, sets: ["2"], point: "30", serving: false, winner: false },
  },
  situation: null,
  summary: "3–2",
  setNumber: 1,
  predictionsOpen: true,
};

const PROPS: PredictionPanelProps = {
  matchId: "match-1",
  board: BOARD,
  prediction: {
    setNumber: 1,
    open: true,
    tally: { votes: { top: 5, bottom: 2 }, share: { top: 71, bottom: 29 }, total: 7 },
    own: null,
  },
  signedIn: true,
  action: async () => INITIAL_ACTION_STATE,
};

describe("PredictionPanel", () => {
  it("shows the set, the split and what a prediction is worth", () => {
    render(<PredictionPanel {...PROPS} />);

    expect(screen.getByRole("heading", { name: "Who takes set 1?" })).toBeInTheDocument();
    expect(screen.getByText("71%")).toBeInTheDocument();
    expect(screen.getByText("Closes at 5 games")).toBeInTheDocument();
    expect(screen.getByText(PREDICTION_DISCLAIMER)).toBeInTheDocument();
  });

  it("lets a signed-in fan vote and marks the side they picked", () => {
    render(<PredictionPanel {...PROPS} prediction={{ ...PROPS.prediction, own: "bottom" }} />);

    expect(screen.getByRole("button", { name: /Y. Malhotra/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /G. Pillai/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("offers sign-in instead of a vote when nobody is signed in", () => {
    render(<PredictionPanel {...PROPS} signedIn={false} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/signin");
  });

  it("stops taking votes once the set closes", () => {
    render(
      <PredictionPanel {...PROPS} prediction={{ ...PROPS.prediction, open: false, own: "top" }} />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Voting closed")).toBeInTheDocument();
    expect(screen.getByLabelText("Y. Malhotra: 71%, your pick")).toBeInTheDocument();
  });
});
