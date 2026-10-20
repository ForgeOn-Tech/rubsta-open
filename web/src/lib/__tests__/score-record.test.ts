import { describe, expect, it } from "vitest";

import type { MatchEvent } from "@/lib/match";
import { ONE_SET, ONE_SET_DECIDING_POINT } from "@/lib/match-formats";
import {
  MAX_EVENTS,
  extendsScore,
  parseDeviceScore,
  parseScoreRecord,
  reconcileScore,
  sameScore,
  scoreRecordOf,
  type DeviceScore,
  type ScoreRecord,
} from "@/lib/score-record";

const STARTED_AT = 1_700_000_000_000;

function record(events: MatchEvent[]): ScoreRecord {
  return { firstServer: "top", decidingSet: "set", format: null, court: 2, startedAt: STARTED_AT, events };
}

function device(baseVersion: number, events: MatchEvent[], unsaved: boolean): DeviceScore {
  return { baseVersion, record: record(events), unsaved };
}

describe("parseScoreRecord", () => {
  it("accepts a well-formed record", () => {
    const input = record([{ type: "point", side: "bottom" }, { type: "fault" }, { type: "let" }]);
    expect(parseScoreRecord(JSON.parse(JSON.stringify(input)))).toEqual(input);
  });

  it("accepts an empty court", () => {
    expect(parseScoreRecord({ ...record([]), court: null }).court).toBeNull();
  });

  it("rejects input that is not an object", () => {
    expect(() => parseScoreRecord(null)).toThrow("The score record must be an object.");
    expect(() => parseScoreRecord([])).toThrow("The score record must be an object.");
  });

  it("rejects an unknown first server or deciding set", () => {
    expect(() => parseScoreRecord({ ...record([]), firstServer: "left" })).toThrow(/first server/);
    expect(() => parseScoreRecord({ ...record([]), decidingSet: "super" })).toThrow(/deciding set/);
  });

  it("rejects a court outside 1 to 99 or not a whole number", () => {
    for (const court of [0, 100, 1.5, "1"]) {
      expect(() => parseScoreRecord({ ...record([]), court })).toThrow(/Court must be/);
    }
  });

  it("rejects a missing start time", () => {
    expect(() => parseScoreRecord({ ...record([]), startedAt: 0 })).toThrow(/start time/);
  });

  it("names the first bad event", () => {
    const events = [{ type: "point", side: "top" }, { type: "point", side: "net" }];
    expect(() => parseScoreRecord({ ...record([]), events })).toThrow(/Event 1 side/);
    expect(() => parseScoreRecord({ ...record([]), events: [{ type: "ace" }] })).toThrow(
      /Event 0 has an unknown type "ace"/,
    );
  });

  it("rejects more events than any match could hold", () => {
    const events = Array.from({ length: MAX_EVENTS + 1 }, () => ({ type: "let" }));
    expect(() => parseScoreRecord({ ...record([]), events })).toThrow(/more than/);
  });
});

describe("parseDeviceScore", () => {
  it("accepts what the scoring page stores", () => {
    const stored = device(3, [{ type: "doubleFault" }], true);
    expect(parseDeviceScore(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
  });

  it("rejects a negative base version or a missing unsaved flag", () => {
    expect(() => parseDeviceScore({ ...device(0, [], true), baseVersion: -1 })).toThrow(/base version/);
    expect(() => parseDeviceScore({ baseVersion: 0, record: record([]) })).toThrow(/unsaved/);
  });
});

describe("score record formats", () => {
  it("reads a record kept before formats existed as the earlier rules", () => {
    const old = { firstServer: "top", decidingSet: "set", court: 2, startedAt: STARTED_AT, events: [] };

    expect(parseScoreRecord(old).format).toBeNull();
  });

  it("reads a record's format and refuses an unknown one", () => {
    expect(parseScoreRecord({ ...record([]), format: ONE_SET }).format).toEqual(ONE_SET);
    expect(() => parseScoreRecord({ ...record([]), format: { setsToWin: 1 } })).toThrow(/Unknown match format/);
  });

  it("treats records with different formats as different scores", () => {
    expect(sameScore({ ...record([]), format: ONE_SET }, { ...record([]), format: ONE_SET_DECIDING_POINT })).toBe(false);
    expect(sameScore({ ...record([]), format: ONE_SET }, record([]))).toBe(false);
    expect(sameScore({ ...record([]), format: ONE_SET }, { ...record([]), format: { ...ONE_SET } })).toBe(true);
  });
});

describe("sameScore", () => {
  it("ignores the court but compares start details and every event", () => {
    const events: MatchEvent[] = [{ type: "point", side: "top" }];
    expect(sameScore(record(events), { ...record(events), court: 5 })).toBe(true);
    expect(sameScore(record(events), { ...record(events), firstServer: "bottom" })).toBe(false);
    expect(sameScore(record(events), record([{ type: "point", side: "bottom" }]))).toBe(false);
    expect(sameScore(record(events), record([...events, { type: "let" }]))).toBe(false);
    expect(sameScore(record([{ type: "fault" }]), record([{ type: "let" }]))).toBe(false);
  });
});

describe("extendsScore", () => {
  const top: MatchEvent = { type: "point", side: "top" };
  const bottom: MatchEvent = { type: "point", side: "bottom" };

  it("accepts a record that only adds events after the shorter one's", () => {
    expect(extendsScore(record([top, bottom]), record([top]))).toBe(true);
    expect(extendsScore(record([top]), record([]))).toBe(true);
  });

  it("accepts a record that adds how a stored point was won", () => {
    const tagged: MatchEvent = { type: "point", side: "top", finish: "winner" };
    expect(extendsScore(record([tagged]), record([top]))).toBe(true);
    expect(extendsScore(record([tagged, bottom]), record([top]))).toBe(true);
    expect(extendsScore(record([top]), record([tagged]))).toBe(false);
  });

  it("rejects an equal, shorter, diverging or differently started record", () => {
    expect(extendsScore(record([top]), record([top]))).toBe(false);
    expect(extendsScore(record([top]), record([top, bottom]))).toBe(false);
    expect(extendsScore(record([bottom, top]), record([top]))).toBe(false);
    expect(extendsScore({ ...record([top, bottom]), decidingSet: "matchTiebreak" }, record([top]))).toBe(
      false,
    );
  });
});

describe("scoreRecordOf", () => {
  it("returns null before the match is started", () => {
    const columns = { firstServer: null, decidingSet: "set" as const, format: null, court: null, startedAt: null, events: [] };
    expect(scoreRecordOf(columns)).toBeNull();
    expect(scoreRecordOf({ ...columns, startedAt: STARTED_AT })).toBeNull();
  });

  it("returns the stored record once started", () => {
    expect(scoreRecordOf(record([{ type: "let" }]))).toEqual(record([{ type: "let" }]));
  });
});

describe("reconcileScore", () => {
  const point: MatchEvent = { type: "point", side: "top" };

  it("uses the server when the device has nothing unsaved", () => {
    expect(reconcileScore(4, record([]), null)).toEqual({ kind: "server" });
    expect(reconcileScore(4, record([]), device(2, [point], false))).toEqual({ kind: "server" });
  });

  it("resumes unsaved device changes while the server is at their base version", () => {
    const stored = device(4, [point], true);
    expect(reconcileScore(4, record([]), stored)).toEqual({ kind: "device", device: stored });
  });

  it("drops unsaved changes the server already holds", () => {
    expect(reconcileScore(5, record([point]), device(4, [point], true))).toEqual({ kind: "server" });
  });

  it("prefers a device record built on a newer version than the page, saved or not", () => {
    const saved = device(6, [point], false);
    const unsaved = device(6, [point, point], true);

    expect(reconcileScore(4, record([]), saved)).toEqual({ kind: "device", device: saved });
    expect(reconcileScore(4, null, unsaved)).toEqual({ kind: "device", device: unsaved });
  });

  it("resumes device changes that only add to what the server holds", () => {
    const tagged = device(4, [{ type: "point", side: "top", finish: "ace" }], true);
    const more = device(4, [point, point], true);
    expect(reconcileScore(5, record([point]), tagged)).toEqual({ kind: "device", device: tagged });
    expect(reconcileScore(5, record([point]), more)).toEqual({ kind: "device", device: more });
  });

  it("reports a conflict when both changed", () => {
    const stored = device(4, [point], true);
    expect(reconcileScore(5, record([{ type: "let" }]), stored)).toEqual({ kind: "conflict", device: stored });
    expect(reconcileScore(5, null, stored)).toEqual({ kind: "conflict", device: stored });
  });
});


it("preserves optional point details through server and offline parsing", () => {
  const events: MatchEvent[] = [{ type: "point", side: "top", finish: "ace" }, { type: "point", side: "bottom", finish: "opponentError" }];
  expect(parseScoreRecord(JSON.parse(JSON.stringify(record(events))))).toEqual(record(events));
  expect(parseDeviceScore(JSON.parse(JSON.stringify(device(1, events, true))))).toEqual(device(1, events, true));
  expect(() => parseScoreRecord({ ...record([]), events: [{ type: "point", side: "top", finish: "invented" }] })).toThrow("unknown point finish");
});

it("treats changed point details as different scores when syncing", () => {
  const original = record([{ type: "point", side: "top", finish: "ace" }]);
  const changed = record([{ type: "point", side: "top", finish: "winner" }]);
  expect(sameScore(original, changed)).toBe(false);
  expect(extendsScore(changed, original)).toBe(false);
});
