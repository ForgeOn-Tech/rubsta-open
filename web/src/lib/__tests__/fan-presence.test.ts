import { describe, expect, it } from "vitest";

import { VIEWER_TIMEOUT_MS, createPresence } from "@/lib/fan-presence";

const NOW = 1_700_000_000_000;
const COURT = 1;

describe("createPresence", () => {
  it("counts each tab once, however often it polls", () => {
    const presence = createPresence();

    presence.seen("tab-a", COURT, NOW);
    presence.seen("tab-a", COURT, NOW + 1_000);

    expect(presence.watching(COURT, NOW + 1_000)).toBe(1);
  });

  it("counts the tabs on one court, and keeps courts apart", () => {
    const presence = createPresence();

    presence.seen("tab-a", COURT, NOW);
    expect(presence.seen("tab-b", COURT, NOW)).toBe(2);
    presence.seen("tab-c", 2, NOW);

    expect(presence.watching(COURT, NOW)).toBe(2);
    expect(presence.watching(2, NOW)).toBe(1);
  });

  it("drops a tab that stops polling", () => {
    const presence = createPresence();

    presence.seen("tab-a", COURT, NOW);

    expect(presence.watching(COURT, NOW + VIEWER_TIMEOUT_MS - 1)).toBe(1);
    expect(presence.watching(COURT, NOW + VIEWER_TIMEOUT_MS)).toBe(0);
  });

  it("moves a tab that opens another court", () => {
    const presence = createPresence();

    presence.seen("tab-a", COURT, NOW);
    presence.seen("tab-a", 2, NOW + 1_000);

    expect(presence.watching(COURT, NOW + 1_000)).toBe(0);
    expect(presence.watching(2, NOW + 1_000)).toBe(1);
  });
});
