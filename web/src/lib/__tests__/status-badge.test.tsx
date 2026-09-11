import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "@/components/status-badge";

describe("StatusBadge", () => {
  it("renders the submitted status", () => {
    render(<StatusBadge status="submitted" />);
    expect(screen.getByText("Submitted")).toBeInTheDocument();
  });

  it("renders the paid status", () => {
    render(<StatusBadge status="paid" />);
    expect(screen.getByText("Paid")).toBeInTheDocument();
  });

  it("renders the cancelled status", () => {
    render(<StatusBadge status="cancelled" />);
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });
});
