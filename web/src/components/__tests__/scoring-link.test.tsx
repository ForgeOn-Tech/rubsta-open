import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
const navigation = vi.hoisted(() => ({ preventDefault: vi.fn() }));
vi.mock("next/link", () => ({ default: ({ href, children, onNavigate }: { href: string; children: ReactNode; onNavigate: (event: { preventDefault: () => void }) => void }) => <a href={href} onClick={event => { event.preventDefault(); onNavigate(navigation); }}>{children}</a> }));
import { ScoringLink } from "../scoring-link";
afterEach(() => { vi.restoreAllMocks(); navigation.preventDefault.mockReset(); });
it.each(["/score", "/score/match-1", "/score/schedule/2026-10-24"])("opens the saved HTML document for %s when offline", href => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  const assign = vi.spyOn(window.location, "assign").mockImplementation(() => {});
  render(<ScoringLink href={href}>Open score</ScoringLink>);
  fireEvent.click(screen.getByRole("link"));
  expect(navigation.preventDefault).toHaveBeenCalledOnce();
  expect(assign).toHaveBeenCalledWith(href);
});
it("keeps normal navigation when online", () => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  const assign = vi.spyOn(window.location, "assign").mockImplementation(() => {});
  render(<ScoringLink href="/score">Open score</ScoringLink>);
  fireEvent.click(screen.getByRole("link"));
  expect(navigation.preventDefault).not.toHaveBeenCalled();
  expect(assign).not.toHaveBeenCalled();
});
