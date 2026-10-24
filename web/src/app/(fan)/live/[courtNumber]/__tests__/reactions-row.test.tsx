import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReactionsRow, type ReactionsRowProps } from "../reactions-row";
import { INITIAL_ACTION_STATE } from "@/lib/form-state";

const PROPS: ReactionsRowProps = {
  matchId: "match-1",
  courtNumber: 2,
  counts: { clap: 312, shot: 184, ball: 97 },
  signedIn: true,
  action: async () => INITIAL_ACTION_STATE,
};

describe("ReactionsRow", () => {
  it("offers each reaction with its count", () => {
    render(<ReactionsRow {...PROPS} />);

    expect(screen.getByRole("button", { name: "Applause: 312" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "What a shot: 184" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Good ball: 97" })).toBeEnabled();
  });

  it("shows counts without buttons when nobody is signed in", () => {
    render(<ReactionsRow {...PROPS} signedIn={false} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Applause: 312")).toBeInTheDocument();
  });

  it("tells a signed-out fan to sign up to react, and brings them back to this court", () => {
    render(<ReactionsRow {...PROPS} signedIn={false} />);

    expect(screen.getByRole("link", { name: "Sign up or sign in" })).toHaveAttribute(
      "href",
      "/signin?next=%2Flive%2F2",
    );
  });

  it("asks a signed-in fan for nothing", () => {
    render(<ReactionsRow {...PROPS} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
