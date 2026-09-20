import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PaymentWelcome } from "../payment-welcome";

const { router } = vi.hoisted(() => ({ router: { replace: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

it("welcomes the player, fades out and clears the confirmation URL", () => {
  vi.useFakeTimers();
  render(<PaymentWelcome name="Devansh" eventLabel="Open singles" />);
  expect(screen.getByRole("status")).toHaveTextContent("Payment confirmed");
  expect(screen.getByRole("status")).toHaveTextContent("Welcome, Devansh!");
  act(() => vi.advanceTimersByTime(4500));
  expect(screen.getByRole("status")).toHaveClass("opacity-0");
  act(() => vi.advanceTimersByTime(700));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(router.replace).toHaveBeenCalledWith("/home", { scroll: false });
});

it("clears timers when navigating away", () => {
  vi.useFakeTimers();
  const { unmount } = render(<PaymentWelcome name="Player" eventLabel="Open doubles" />);
  unmount();
  act(() => vi.advanceTimersByTime(6000));
  expect(router.replace).not.toHaveBeenCalled();
});
