import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EntryStatusActions } from "../entry-status-actions";

async function noopAction(): Promise<void> {}

const SUBJECT = "Gaurav Pillai, Men's singles";

describe("EntryStatusActions", () => {
  it("offers confirm and cancel for a submitted entry, naming the entry", () => {
    render(
      <EntryStatusActions entryId="e1" status="submitted" subject={SUBJECT} action={noopAction} />,
    );

    expect(screen.getByRole("button", { name: `Confirm: ${SUBJECT}` })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Cancel: ${SUBJECT}` })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mark paid/ })).not.toBeInTheDocument();
  });

  it("sends the entry id and target status with each button", () => {
    const { container } = render(
      <EntryStatusActions entryId="e1" status="confirmed" subject={SUBJECT} action={noopAction} />,
    );

    const forms = [...container.querySelectorAll("form")].map((form) =>
      Object.fromEntries(new FormData(form)),
    );
    expect(forms).toEqual([
      { entryId: "e1", to: "paid" },
      { entryId: "e1", to: "cancelled" },
    ]);
  });

  it("offers only reinstate for a cancelled entry", () => {
    render(
      <EntryStatusActions entryId="e1" status="cancelled" subject={SUBJECT} action={noopAction} />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: `Reinstate: ${SUBJECT}` })).toBeInTheDocument();
  });
});
