import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { AvatarStudio } from "../../avatar/avatar-studio";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("shows a non-blocking message when no API key is configured", () => {
  render(<AvatarStudio name="Player" enabled={false} initialVersion={null} accessError={null} />);
  expect(screen.getByRole("status")).toHaveTextContent("coming soon");
  expect(screen.queryByRole("button", { name: "Generate my tennis avatar" })).not.toBeInTheDocument();
});
it("reveals processing consent only after a photo is selected", async () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  render(<AvatarStudio name="Player" enabled initialVersion={null} accessError={null} />);
  expect(screen.getByLabelText(/Your photo/)).toBeRequired();
  expect(screen.getByRole("button", { name: "Upload photo" })).toBeVisible();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Your caption")).not.toBeInTheDocument();
  await userEvent.upload(screen.getByLabelText(/Your photo/), new File(["portrait"], "portrait.png", { type: "image/png" }));
  expect(screen.getByRole("checkbox")).toBeRequired();
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(screen.getByText(/Nothing is posted automatically/)).toBeVisible();
});
it("restores an existing avatar and requires preview before downloading", () => {
  render(<AvatarStudio name="Player" enabled initialVersion={123} accessError={null} />);
  expect(screen.getByAltText("Your illustrated tennis avatar")).toHaveAttribute("src", "/api/avatar?v=123");
  expect(screen.getByRole("button", { name: /Preview my card/ })).toBeVisible();
  expect(screen.queryByLabelText(/Your photo/)).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Download my card" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Let Rubsta post it on Instagram" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Photo$/ })).toBeDisabled();
  expect(screen.queryByRole("button", { name: /(?:Create|Generate) another avatar/ })).not.toBeInTheDocument();
});
