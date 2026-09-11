import { describe, expect, it } from "vitest";

import type { Match } from "@/db/schema";
import type { MatchEvent, Side } from "@/lib/match";
import type { ScoreRecord } from "@/lib/score-record";
import {
  deviceScoreOf,
  hasUnsavedChanges,
  initialScorerState,
  pendingSave,
  retryDelayMs,
  scorerReducer,
  snapshotOf,
  type MatchSnapshot,
  type ScorerAction,
  type ScorerState,
} from "@/lib/score-sync";

const STARTED_AT = 1_700_000_000_000;

function point(side: Side): MatchEvent {
  return { type: "point", side };
}

function record(events: MatchEvent[]): ScoreRecord {
  return { firstServer: "top", decidingSet: "set", court: 3, startedAt: STARTED_AT, events };
}

function snapshot(version: number, events: MatchEvent[] | null): MatchSnapshot {
  return {
    version,
    status: events === null ? "scheduled" : "in_progress",
    winner: null,
    record: events === null ? null : record(events),
  };
}

function run(state: ScorerState, ...actions: ScorerAction[]): ScorerState {
  return actions.reduce(scorerReducer, state);
}

/** Top wins the first set 6–0 and leads 5–0 40–0: one point from the match. */
function matchPointEvents(): MatchEvent[] {
  return Array.from({ length: 4 * 11 + 3 }, () => point("top"));
}

const MATCH: Match = {
  id: "m1",
  drawId: "d1",
  matchNumber: 2,
  roundIndex: 0,
  roundName: "Semi-finals",
  topSlot: { kind: "entry", entryId: "b" },
  bottomSlot: { kind: "entry", entryId: "c" },
  events: [],
  decidingSet: "set",
  firstServer: null,
  status: "scheduled",
  winnerEntryId: null,
  court: null,
  startedAt: null,
  completedAt: null,
  version: 0,
  createdAt: STARTED_AT,
  updatedAt: STARTED_AT,
};

describe("snapshotOf", () => {
  it("has no record before the match starts", () => {
    expect(snapshotOf(MATCH)).toEqual({ version: 0, status: "scheduled", winner: null, record: null });
  });

  it("names the winning side from the winner's entry", () => {
    expect(snapshotOf({ ...MATCH, status: "completed", winnerEntryId: "c" }).winner).toBe("bottom");
    expect(snapshotOf({ ...MATCH, status: "completed", winnerEntryId: "b" }).winner).toBe("top");
  });
});

describe("initialScorerState", () => {
  it("uses the server record when the device has nothing unsaved", () => {
    const state = initialScorerState(snapshot(2, [point("top")]), null);

    expect(state).toMatchObject({ baseVersion: 2, record: record([point("top")]), conflict: null });
    expect(hasUnsavedChanges(state)).toBe(false);
  });

  it("resumes unsaved device changes and queues them for saving", () => {
    const device = { baseVersion: 2, record: record([point("top"), point("top")]), unsaved: true };

    const state = initialScorerState(snapshot(2, [point("top")]), device);

    expect(state.record).toEqual(device.record);
    expect(pendingSave(state)).toEqual({ revision: 1, baseVersion: 2, record: device.record });
  });

  it("opens in conflict when the server moved on and differs", () => {
    const server = snapshot(3, [point("bottom")]);
    const device = { baseVersion: 2, record: record([point("top")]), unsaved: true };

    const state = initialScorerState(server, device);

    expect(state.conflict).toEqual(server);
    expect(pendingSave(state)).toBeNull();
  });
});

describe("scorerReducer", () => {
  it("starts the match and queues the first save", () => {
    const state = run(initialScorerState(snapshot(0, null), null), {
      type: "start",
      record: record([]),
    });

    expect(state.status).toBe("in_progress");
    expect(pendingSave(state)).toEqual({ revision: 1, baseVersion: 0, record: record([]) });
  });

  it("applies each tap at once and keeps a later revision unsaved while one is sending", () => {
    let state = initialScorerState(snapshot(1, []), null);

    state = run(state, { type: "score", event: point("top") }, { type: "sendStarted", revision: 1 });
    expect(pendingSave(state)).toBeNull();

    state = run(state, { type: "score", event: { type: "fault" } });
    expect(state.record?.events).toEqual([point("top"), { type: "fault" }]);

    state = run(state, { type: "saved", revision: 1, match: snapshot(2, [point("top")]) });
    expect(pendingSave(state)).toEqual({
      revision: 2,
      baseVersion: 2,
      record: record([point("top"), { type: "fault" }]),
    });
  });

  it("holds a point that ends the match until the umpire confirms it", () => {
    let state = initialScorerState(snapshot(1, matchPointEvents()), null);

    state = run(state, { type: "score", event: point("top") });
    expect(state.finalEvent).toEqual(point("top"));
    expect(pendingSave(state)).toBeNull();
    expect(() => run(state, { type: "score", event: point("bottom") })).toThrow(/final point/);

    state = run(state, { type: "confirmFinal" });
    expect(state.finalEvent).toBeNull();
    expect(state.record?.events).toHaveLength(matchPointEvents().length + 1);
  });

  it("drops a held final point on undo without touching the saved events", () => {
    const state = run(
      initialScorerState(snapshot(1, matchPointEvents()), null),
      { type: "score", event: point("top") },
      { type: "undo" },
    );

    expect(state.finalEvent).toBeNull();
    expect(state.record?.events).toHaveLength(matchPointEvents().length);
    expect(hasUnsavedChanges(state)).toBe(false);
  });

  it("undoes the last event, and does nothing when there is none", () => {
    const start = initialScorerState(snapshot(1, [point("top")]), null);

    const undone = run(start, { type: "undo" });
    expect(undone.record?.events).toEqual([]);
    expect(run(undone, { type: "undo" })).toBe(undone);
  });

  it("counts failures for backoff and retries at once when asked", () => {
    let state = run(
      initialScorerState(snapshot(1, []), null),
      { type: "score", event: point("top") },
      { type: "sendStarted", revision: 1 },
      { type: "sendFailed", revision: 1 },
    );
    expect(state.failures).toBe(1);
    expect(retryDelayMs(state.failures)).toBe(1_000);
    expect(pendingSave(state)).not.toBeNull();

    state = run(state, { type: "retryNow" });
    expect(retryDelayMs(state.failures)).toBe(0);
  });

  it("caps the retry delay", () => {
    expect(retryDelayMs(0)).toBe(0);
    expect(retryDelayMs(50)).toBe(10_000);
  });

  it("stops saving after a refusal until the umpire retries", () => {
    let state = run(
      initialScorerState(snapshot(1, []), null),
      { type: "score", event: point("top") },
      { type: "sendStarted", revision: 1 },
      { type: "rejected", revision: 1, message: "Sign in again to save scores." },
    );
    expect(state.error).toBe("Sign in again to save scores.");
    expect(pendingSave(state)).toBeNull();

    state = run(state, { type: "retryNow" });
    expect(pendingSave(state)).not.toBeNull();
  });

  it("keeps the device score over a conflict by saving it on the server's version", () => {
    const server = snapshot(4, [point("bottom")]);
    let state = run(
      initialScorerState(snapshot(1, []), null),
      { type: "score", event: point("top") },
      { type: "sendStarted", revision: 1 },
      { type: "conflicted", revision: 1, match: server },
    );
    expect(pendingSave(state)).toBeNull();

    state = run(state, { type: "keepDevice" });
    expect(pendingSave(state)).toEqual({ revision: 2, baseVersion: 4, record: record([point("top")]) });
  });

  it("refuses to keep the device score over a match completed elsewhere", () => {
    const retired: MatchSnapshot = { ...snapshot(4, []), status: "completed", winner: "bottom" };
    const state = run(
      initialScorerState(snapshot(1, []), null),
      { type: "score", event: point("top") },
      { type: "sendStarted", revision: 1 },
      { type: "conflicted", revision: 1, match: retired },
    );

    expect(() => run(state, { type: "keepDevice" })).toThrow(/completed elsewhere/);
  });

  it("replaces the device score with the server's and treats it as saved", () => {
    const retired: MatchSnapshot = { ...snapshot(5, [point("top")]), status: "completed", winner: "top" };

    const state = run(
      initialScorerState(snapshot(1, []), null),
      { type: "score", event: point("bottom") },
      { type: "replaceWithServer", match: retired },
    );

    expect(state).toMatchObject({ baseVersion: 5, status: "completed", winner: "top", conflict: null });
    expect(state.record).toEqual(record([point("top")]));
    expect(hasUnsavedChanges(state)).toBe(false);
  });

  it("ignores a response for a save that is no longer in flight", () => {
    const replaced = run(
      initialScorerState(snapshot(1, []), null),
      { type: "score", event: point("top") },
      { type: "sendStarted", revision: 1 },
      { type: "replaceWithServer", match: snapshot(3, []) },
    );

    const after = run(replaced, { type: "saved", revision: 1, match: snapshot(2, [point("top")]) });

    expect(after).toBe(replaced);
  });
});

describe("deviceScoreOf", () => {
  it("keeps nothing before the match starts, then the record and whether it is unsaved", () => {
    const fresh = initialScorerState(snapshot(0, null), null);
    expect(deviceScoreOf(fresh)).toBeNull();

    const started = run(fresh, { type: "start", record: record([]) });
    expect(deviceScoreOf(started)).toEqual({ baseVersion: 0, record: record([]), unsaved: true });
  });
});
