import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminNav } from "../admin-nav";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/entries/entry-1" }));

describe("AdminNav", () => {
  it("marks the current section, including its sub-pages", () => {
    render(<AdminNav />);

    expect(screen.getByRole("link", { name: "Entries" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
  });

  it("shows unbuilt sections as text, not links", () => {
    render(<AdminNav />);

    expect(screen.queryByRole("link", { name: /Order of play/ })).not.toBeInTheDocument();
    expect(screen.getByText("Order of play")).toHaveAttribute("aria-disabled", "true");
  });
});
