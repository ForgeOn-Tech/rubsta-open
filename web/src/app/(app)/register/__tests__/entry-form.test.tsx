import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { EntryForm, type EntryFormProps } from "../entry-form";
import { CATEGORIES } from "@/db/schema";
import type { EntryFormState } from "@/lib/entries";

const ACTION_ERROR = "Entries are closed.";

async function rejectingAction(): Promise<EntryFormState> {
  return { error: ACTION_ERROR };
}

const BASE_PROPS: EntryFormProps = {
  action: rejectingAction,
  tournamentId: "tournament-1",
  enteredCategories: [],
  feeLabel: "₹1,500",
  closesLabel: "22 Sep, 18:00 IST",
  paymentsEnabled: false,
};

describe("EntryForm", () => {
  it("disables events the player has already entered", () => {
    render(<EntryForm {...BASE_PROPS} enteredCategories={["MS"]} />);

    expect(screen.getByRole("radio", { name: "Men's singles" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Women's singles" })).toBeChecked();
  });

  it("asks for a partner only in doubles", async () => {
    const user = userEvent.setup();
    render(<EntryForm {...BASE_PROPS} />);

    expect(screen.queryByLabelText("Partner name")).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Men's doubles" }));
    expect(screen.getByLabelText("Partner name")).toBeRequired();
    expect(screen.getByLabelText("Partner email")).toBeRequired();

    await user.click(screen.getByRole("radio", { name: "Women's singles" }));
    expect(screen.queryByLabelText("Partner name")).not.toBeInTheDocument();
  });

  it("submits directly when payments are off", () => {
    render(<EntryForm {...BASE_PROPS} />);

    expect(screen.getByRole("button", { name: "Submit entry" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Continue to payment" }),
    ).not.toBeInTheDocument();
  });

  it("opens the stub checkout before paying when payments are on", async () => {
    const user = userEvent.setup();
    render(<EntryForm {...BASE_PROPS} paymentsEnabled />);

    await user.click(screen.getByRole("button", { name: "Continue to payment" }));

    expect(screen.getByRole("heading", { name: "Test checkout" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay ₹1,500" })).toBeInTheDocument();
  });

  it("shows the error returned by the server action", async () => {
    const user = userEvent.setup();
    render(<EntryForm {...BASE_PROPS} />);

    await user.click(screen.getByRole("button", { name: "Submit entry" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(ACTION_ERROR);
  });

  it("tells the player when every event is entered", () => {
    render(<EntryForm {...BASE_PROPS} enteredCategories={CATEGORIES} />);

    expect(screen.getByRole("status")).toHaveTextContent("You have entered every event.");
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});
