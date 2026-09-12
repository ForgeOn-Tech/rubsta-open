import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CourtChat, type CourtChatProps } from "../court-chat";
import { MAX_FAN_MESSAGE_LENGTH } from "@/lib/fan-chat";
import { INITIAL_ACTION_STATE } from "@/lib/form-state";
import { venueClock } from "@/lib/schedule";

const AT = 1_700_000_000_000;

const PROPS: CourtChatProps = {
  courtNumber: 1,
  messages: [
    { id: "m1", name: "Rhea S.", body: "That backhand was ridiculous", createdAt: AT },
    { id: "m2", name: "Arjun K.", body: "Pillai has to hold here", createdAt: AT + 60_000 },
  ],
  signedIn: true,
  action: async () => INITIAL_ACTION_STATE,
};

describe("CourtChat", () => {
  it("lists what fans have said, with the time at the venue", () => {
    render(<CourtChat {...PROPS} />);

    const messages = screen.getAllByRole("listitem");

    expect(messages).toHaveLength(2);
    expect(within(messages[0]).getByText("Rhea S.")).toBeInTheDocument();
    expect(within(messages[0]).getByText("That backhand was ridiculous")).toBeInTheDocument();
    expect(within(messages[0]).getByText(venueClock(AT))).toBeInTheDocument();
  });

  it("gives a signed-in fan a box to write in", () => {
    render(<CourtChat {...PROPS} />);

    expect(screen.getByLabelText("Message")).toHaveAttribute("maxlength", String(MAX_FAN_MESSAGE_LENGTH));
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("asks a signed-out fan to sign in", () => {
    render(<CourtChat {...PROPS} signedIn={false} />);

    expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/signin");
  });

  it("says when nobody has spoken yet", () => {
    render(<CourtChat {...PROPS} messages={[]} />);

    expect(screen.getByText("No messages yet. Say something.")).toBeInTheDocument();
  });
});
