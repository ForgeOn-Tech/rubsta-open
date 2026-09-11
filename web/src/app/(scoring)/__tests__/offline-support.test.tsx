import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OfflineSupport } from "../offline-support";

const route = vi.hoisted(() => ({ pathname: "/score" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

function fakeServiceWorkers(controlled: boolean) {
  const postMessage = vi.fn();
  const registration = { active: { postMessage } };
  const workers = {
    controller: controlled ? {} : null,
    register: vi.fn(async () => registration),
    ready: Promise.resolve(registration),
  };
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: workers });
  return { workers, postMessage };
}

function loadedFiles(urls: readonly string[]): void {
  vi.spyOn(performance, "getEntriesByType").mockReturnValue(
    urls.map((name) => ({ name, entryType: "resource", startTime: 0, duration: 0, toJSON: () => ({}) })),
  );
}

async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "serviceWorker");
  vi.restoreAllMocks();
  route.pathname = "/score";
});

describe("OfflineSupport", () => {
  it("registers the worker for the scoring pages and asks it to keep a page it did not serve", async () => {
    const { workers, postMessage } = fakeServiceWorkers(false);
    const chunk = `${window.location.origin}/_next/static/chunks/app.js`;
    loadedFiles([chunk, `${window.location.origin}/api/matches`]);

    render(<OfflineSupport />);

    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));
    expect(workers.register).toHaveBeenCalledWith("/sw.js", { scope: "/score" });
    expect(postMessage).toHaveBeenCalledWith({
      type: "cache-urls",
      urls: [window.location.href, chunk],
    });
  });

  it("skips a page the worker served as it loaded, then asks after a client-side navigation", async () => {
    const { workers, postMessage } = fakeServiceWorkers(true);
    loadedFiles([]);

    const { rerender } = render(<OfflineSupport />);
    await waitFor(() => expect(workers.register).toHaveBeenCalledTimes(1));
    await flushPromises();
    expect(postMessage).not.toHaveBeenCalled();

    route.pathname = "/score/m2";
    rerender(<OfflineSupport />);

    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));
  });
});
