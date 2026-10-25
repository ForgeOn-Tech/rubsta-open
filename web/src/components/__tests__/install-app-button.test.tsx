import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { InstallAppButton } from "../install-app-button";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36";

function browser(userAgent: string, standalone: boolean) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: standalone, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList);
}

function installEvent(outcome: "accepted" | "dismissed") {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  return Object.assign(event, {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome }),
  });
}

afterEach(() => { vi.restoreAllMocks(); });

it("opens the browser's install dialog and hides once installed", async () => {
  browser(ANDROID, false);
  render(<InstallAppButton />);
  expect(screen.queryByRole("button")).toBeNull();
  const event = installEvent("accepted");
  act(() => { window.dispatchEvent(event); });
  expect(event.defaultPrevented).toBe(true);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Install app" })); });
  expect(event.prompt).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button")).toBeNull();
});

it("shows the Share-menu steps on an iPhone", () => {
  browser(IPHONE, false);
  render(<InstallAppButton />);
  fireEvent.click(screen.getByRole("button", { name: "Install app" }));
  expect(screen.getByRole("region", { name: "Install Rubsta Open" })).toHaveTextContent("Add to Home Screen");
});

it("shows nothing inside the installed app", () => {
  browser(IPHONE, true);
  render(<InstallAppButton />);
  expect(screen.queryByRole("button")).toBeNull();
});

it("shows nothing where the browser cannot install", () => {
  browser(ANDROID, false);
  render(<InstallAppButton />);
  expect(screen.queryByRole("button")).toBeNull();
});
