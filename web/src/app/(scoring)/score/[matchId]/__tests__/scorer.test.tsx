import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { saveScore, type SaveOutcome } from "../save-score";
import { Scorer, type ScorerProps } from "../scorer";
import type { MatchEvent, Side } from "@/lib/match";
import type { ScoreRecord } from "@/lib/score-record";
import type { MatchSnapshot, PendingSave } from "@/lib/score-sync";

vi.mock("../save-score", () => ({ saveScore: vi.fn() }));
const mockedSave = vi.mocked(saveScore);

const MATCH_ID = "match-1";
const STORAGE_KEY = `tournament-os:score:${MATCH_ID}`;
const STARTED_AT = 1_700_000_000_000;

function point(side: Side): MatchEvent {
  return { type: "point", side };
}

function record(events: MatchEvent[]): ScoreRecord {
  return { firstServer: "top", decidingSet: "set", court: 1, startedAt: STARTED_AT, events };
}

function snapshot(version: number, events: MatchEvent[] | null): MatchSnapshot {
  return {
    version,
    status: events === null ? "scheduled" : "in_progress",
    winner: null,
    record: events === null ? null : record(events),
  };
}

/** Answers every save as the server would when nothing else changed the match. */
async function savedAsSent(_matchId: string, save: PendingSave): Promise<SaveOutcome> {
  return {
    kind: "saved",
    match: { version: save.baseVersion + 1, status: "in_progress", winner: null, record: save.record },
  };
}

function scorerProps(initial: MatchSnapshot, courts: ScorerProps["courts"]): ScorerProps {
  return {
    matchId: MATCH_ID,
    matchNumber: 2,
    heading: "Men's singles · Semi-finals",
    court: 1,
    courts,
    sides: { top: { name: "Asha Anand", seed: 1 }, bottom: { name: "Bela Rao", seed: null } },
    ready: true,
    initial,
    retireAction: vi.fn(),
    resetAction: vi.fn(),
  };
}

/** A tournament without courts, so the umpire types the court number. */
function renderScorer(initial: MatchSnapshot) {
  return render(<Scorer {...scorerProps(initial, [])} />);
}

function scoreRow(name: string): HTMLElement {
  return screen.getByRole("row", { name: new RegExp(name) });
}

/** In-memory Storage: Node's own global localStorage hides happy-dom's in this environment. */
function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => {
      items.delete(key);
    },
    setItem: (key, value) => {
      items.set(key, String(value));
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  mockedSave.mockReset();
});

afterEach(() => {
  // Unmount first: a late effect must not write to storage after the stub is gone.
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function keptScore(): unknown {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
}

describe("Scorer", () => {
  it("starts the match on the device and saves it", async () => {
    mockedSave.mockImplementation(savedAsSent);
    renderScorer(snapshot(0, null));

    fireEvent.click(screen.getByRole("radio", { name: "Bela Rao" }));
    fireEvent.click(screen.getByRole("button", { name: "Start match" }));

    expect(screen.getByRole("button", { name: /^Point — Bela Rao/ })).toHaveTextContent("SERVING");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"));
    expect(mockedSave).toHaveBeenCalledWith(
      MATCH_ID,
      expect.objectContaining({
        baseVersion: 0,
        record: expect.objectContaining({ firstServer: "bottom", court: 1, events: [] }),
      }),
    );
  });

  it("offers the tournament's courts, starting on the scheduled one", async () => {
    mockedSave.mockImplementation(savedAsSent);
    const courts = [
      { number: 1, label: "Court 1 · Centre" },
      { number: 3, label: "Court 3" },
    ];
    render(<Scorer {...scorerProps(snapshot(0, null), courts)} />);

    const court = screen.getByLabelText(/^Court/);
    expect(court).toHaveValue("1");
    fireEvent.change(court, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("radio", { name: "Asha Anand" }));
    fireEvent.click(screen.getByRole("button", { name: "Start match" }));

    await waitFor(() =>
      expect(mockedSave).toHaveBeenCalledWith(
        MATCH_ID,
        expect.objectContaining({ record: expect.objectContaining({ court: 3 }) }),
      ),
    );
  });

  it("asks who serves first before starting", () => {
    renderScorer(snapshot(0, null));

    fireEvent.click(screen.getByRole("button", { name: "Start match" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Choose who serves first.");
    expect(mockedSave).not.toHaveBeenCalled();
  });

  it("shows a point at once and keeps it on the device while saves fail", async () => {
    mockedSave.mockResolvedValue({ kind: "failed" });
    renderScorer(snapshot(1, []));

    fireEvent.click(screen.getByRole("button", { name: /^Point — Asha Anand/ }));

    expect(scoreRow("Asha Anand")).toHaveTextContent("15");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Offline"));
    await waitFor(() =>
      expect(keptScore()).toMatchObject({
        baseVersion: 1,
        unsaved: true,
        record: { events: [point("top")] },
      }),
    );
  });

  it("saves again as soon as the browser reports it is back online", async () => {
    mockedSave.mockResolvedValueOnce({ kind: "failed" }).mockImplementation(savedAsSent);
    renderScorer(snapshot(1, []));

    fireEvent.click(screen.getByRole("button", { name: /^Point — Asha Anand/ }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Offline"));
    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"));
    expect(mockedSave).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(keptScore()).toMatchObject({ baseVersion: 2, unsaved: false }));
  });

  it("keeps retrying with backoff while the signal stays bad", async () => {
    // No online event: the browser still reports a connection, but saves fail.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockedSave
      .mockResolvedValueOnce({ kind: "failed" })
      .mockResolvedValueOnce({ kind: "failed" })
      .mockImplementation(savedAsSent);
    renderScorer(snapshot(1, []));

    fireEvent.click(screen.getByRole("button", { name: /^Point — Asha Anand/ }));
    await waitFor(() => expect(mockedSave).toHaveBeenCalledTimes(1));
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    await waitFor(() => expect(mockedSave).toHaveBeenCalledTimes(2));
    await act(() => vi.advanceTimersByTimeAsync(2_000));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"));
    expect(mockedSave).toHaveBeenCalledTimes(3);
  });

  it("resumes unsaved points kept on the device after a reload", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ baseVersion: 1, unsaved: true, record: record([point("bottom")]) }),
    );
    mockedSave.mockImplementation(savedAsSent);

    renderScorer(snapshot(1, []));

    expect(scoreRow("Bela Rao")).toHaveTextContent("15");
    await waitFor(() =>
      expect(mockedSave).toHaveBeenCalledWith(MATCH_ID, expect.objectContaining({ baseVersion: 1 })),
    );
  });

  it("shows the newer score kept on the device when the page is an older copy", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ baseVersion: 4, unsaved: false, record: record([point("bottom"), point("bottom")]) }),
    );

    renderScorer(snapshot(2, [point("bottom")]));

    expect(scoreRow("Bela Rao")).toHaveTextContent("30");
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    expect(mockedSave).not.toHaveBeenCalled();
  });

  it("holds the match point for confirmation before saving it", async () => {
    mockedSave.mockImplementation(savedAsSent);
    // Top leads 6–0 5–0 40–0.
    renderScorer(snapshot(1, Array.from({ length: 47 }, () => point("top"))));

    fireEvent.click(screen.getByRole("button", { name: /^Point — Asha Anand/ }));

    expect(screen.getByRole("heading", { name: "Game, set and match — Asha Anand" })).toBeInTheDocument();
    expect(mockedSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm result" }));

    expect(screen.getByRole("heading", { name: "Asha Anand wins" })).toBeInTheDocument();
    await waitFor(() => expect(mockedSave).toHaveBeenCalledTimes(1));
    expect(mockedSave.mock.calls[0][1].record.events).toHaveLength(48);
  });

  it("offers the saved score when another device changed the match", async () => {
    mockedSave.mockResolvedValue({ kind: "conflict", match: snapshot(4, [point("bottom"), point("bottom")]) });
    renderScorer(snapshot(1, []));

    fireEvent.click(screen.getByRole("button", { name: /^Point — Asha Anand/ }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("changed on another device");

    fireEvent.click(within(alert).getByRole("button", { name: "Use the saved score" }));

    expect(scoreRow("Bela Rao")).toHaveTextContent("30");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });
});
