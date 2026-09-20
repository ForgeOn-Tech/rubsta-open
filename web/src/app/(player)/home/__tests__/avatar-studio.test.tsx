import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { AvatarStudio } from "../avatar-studio";

afterEach(cleanup);
it("shows a non-blocking message when no API key is configured", () => {
  render(<AvatarStudio name="Player" enabled={false} initialVersion={null} accessError={null} />);
  expect(screen.getByRole("status")).toHaveTextContent("coming soon");
  expect(screen.queryByRole("button", { name: "Generate my tennis avatar" })).not.toBeInTheDocument();
});
it("requires a photo and explicit consent without default opt-in", () => {
  render(<AvatarStudio name="Player" enabled initialVersion={null} accessError={null} />);
  expect(screen.getByLabelText(/Your photo/)).toBeRequired();
  expect(screen.getByRole("checkbox")).toBeRequired();
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(screen.getByText(/Nothing is posted automatically/)).toBeVisible();
});
it("restores an existing avatar and requires preview before downloading", () => {
  render(<AvatarStudio name="Player" enabled initialVersion={123} accessError={null} />);
  expect(screen.getByAltText("Your illustrated tennis avatar")).toHaveAttribute("src", "/api/avatar?v=123");
  expect(screen.getByRole("button", { name: "Preview Instagram card" })).toBeVisible();
  expect(screen.queryByRole("link", { name: "Download Instagram card" })).not.toBeInTheDocument();
});
