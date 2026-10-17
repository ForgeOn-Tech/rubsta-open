import { describe, expect, it } from "vitest";

import {
  DEFAULT_MATCH_LENGTHS,
  clockOf,
  courtEnd,
  expectedMinutes,
  minutesOf,
  planDay,
  timingFor,
  validateFillRequest,
  type PlanMatch,
  type RawFillRequest,
} from "@/lib/auto-schedule";
import { BEST_OF_THREE, EIGHT_GAMES, ONE_SET, ONE_SET_DECIDING_POINT } from "@/lib/match-formats";

const EIGHT = minutesOf("08:00");
const REST = 30;

function match(id: string, players: string[], minutes: number, after: string[]): PlanMatch {
  return { id, players, readyAt: EIGHT, after, minutes };
}

function courts(count: number) {
  return Array.from({ length: count }, (_unused, index) => ({ courtNumber: index + 1, freeFrom: EIGHT }));
}

describe("expectedMinutes", () => {
  it("goes by the format's length", () => {
    expect(expectedMinutes(ONE_SET, DEFAULT_MATCH_LENGTHS)).toBe(45);
    expect(expectedMinutes(ONE_SET_DECIDING_POINT, DEFAULT_MATCH_LENGTHS)).toBe(45);
    expect(expectedMinutes(EIGHT_GAMES, DEFAULT_MATCH_LENGTHS)).toBe(60);
    expect(expectedMinutes(BEST_OF_THREE, DEFAULT_MATCH_LENGTHS)).toBe(90);
  });
});

describe("clock times", () => {
  it("turns times into minutes and back", () => {
    expect(minutesOf("08:30")).toBe(510);
    expect(clockOf(510)).toBe("08:30");
    expect(clockOf(5000)).toBe("23:59");
  });
});

describe("planDay", () => {
  it("plays matches with different players side by side", () => {
    // Act
    const plan = planDay({
      courts: courts(2),
      matches: [match("m1", ["a", "b"], 45, []), match("m2", ["c", "d"], 45, [])],
      restMinutes: REST,
      busyUntil: new Map(),
    });

    // Assert
    expect(plan.placed.map((item) => [item.matchId, item.courtNumber, clockOf(item.start)])).toEqual([
      ["m1", 1, "08:00"],
      ["m2", 2, "08:00"],
    ]);
  });

  it("gives a player in two matches the rest between them, even with a court free", () => {
    const plan = planDay({
      courts: courts(2),
      matches: [match("singles", ["a", "b"], 45, []), match("doubles", ["a", "c", "d", "e"], 45, [])],
      restMinutes: REST,
      busyUntil: new Map(),
    });

    expect(plan.placed.map((item) => clockOf(item.start))).toEqual(["08:00", "09:15"]);
  });

  it("starts a match only after the matches it waits on, plus rest", () => {
    const plan = planDay({
      courts: courts(3),
      matches: [match("semi", ["a", "b"], 90, []), match("final", ["a", "b", "c", "d"], 90, ["semi"])],
      restMinutes: REST,
      busyUntil: new Map(),
    });

    expect(clockOf(plan.placed[1].start)).toBe("10:00");
  });

  it("leaves out a match whose earlier match is not in the plan", () => {
    const plan = planDay({
      courts: courts(1),
      matches: [match("final", ["a", "b"], 90, ["missing"])],
      restMinutes: REST,
      busyUntil: new Map(),
    });

    expect(plan).toEqual({ placed: [], unplaced: ["final"] });
  });

  it("rests players after matches already on the day and rounds starts to five minutes", () => {
    const plan = planDay({
      courts: [{ courtNumber: 1, freeFrom: minutesOf("09:02") }],
      matches: [match("m1", ["a", "b"], 45, [])],
      restMinutes: REST,
      busyUntil: new Map([["a", minutesOf("09:10")]]),
    });

    expect(clockOf(plan.placed[0].start)).toBe("09:40");
  });

  it("needs a court", () => {
    expect(() => planDay({ courts: [], matches: [], restMinutes: REST, busyUntil: new Map() })).toThrow(/at least one court/);
  });
});

describe("timingFor", () => {
  it("starts an empty court at a time, follows on without a gap, and waits otherwise", () => {
    expect(timingFor(EIGHT, null)).toEqual({ timing: "at", time: "08:00" });
    expect(timingFor(minutesOf("08:45"), minutesOf("08:45"))).toEqual({ timing: "followOn", time: null });
    expect(timingFor(minutesOf("09:15"), minutesOf("08:45"))).toEqual({ timing: "notBefore", time: "09:15" });
  });
});

describe("courtEnd", () => {
  it("walks a court's items: fixed times, waits and follow-ons, sessions to their end", () => {
    const end = courtEnd(
      [
        { timing: "at", time: "09:00", endTime: null, minutes: 45 },
        { timing: "followOn", time: null, endTime: null, minutes: 60 },
        { timing: "notBefore", time: "10:00", endTime: null, minutes: 45 },
        { timing: "at", time: "12:00", endTime: "13:00", minutes: null },
      ],
      EIGHT,
    );

    expect(clockOf(end ?? 0)).toBe("13:00");
    expect(courtEnd([], EIGHT)).toBeNull();
    expect(clockOf(courtEnd([{ timing: "followOn", time: null, endTime: null, minutes: 45 }], EIGHT) ?? 0)).toBe("08:45");
  });
});

describe("validateFillRequest", () => {
  const RAW: RawFillRequest = {
    day: "2026-10-24",
    courts: ["2", "1"],
    startTime: "08:30",
    restMinutes: "30",
    oneSet: "45",
    eightGames: "60",
    bestOfThree: "90",
    rounds: ["OS|Group A"],
  };
  const DAYS = ["2026-10-24", "2026-10-25"];

  it("reads the form, courts in order", () => {
    expect(validateFillRequest(RAW, DAYS, [1, 2, 3])).toEqual({
      ok: true,
      request: {
        day: "2026-10-24",
        courts: [1, 2],
        startTime: "08:30",
        restMinutes: 30,
        lengths: { oneSet: 45, eightGames: 60, bestOfThree: 90 },
        rounds: ["OS|Group A"],
      },
    });
  });

  it.each([
    ["a day outside the tournament", { day: "2026-10-30" }, "Choose one of the tournament's days."],
    ["no courts", { courts: [] }, "Choose at least one of the courts."],
    ["a court that does not exist", { courts: ["1", "9"] }, "Choose at least one of the courts."],
    ["a bad start time", { startTime: "25:00" }, "Enter a start time such as 08:00."],
    ["a negative rest", { restMinutes: "-5" }, "Rest must be a whole number of minutes from 0 to 240."],
    ["a match that is too short", { oneSet: "5" }, "Match lengths must be whole minutes from 10 to 300."],
    ["no rounds", { rounds: [] }, "Choose at least one round to place."],
  ])("refuses %s", (_case, change, error) => {
    expect(validateFillRequest({ ...RAW, ...change }, DAYS, [1, 2, 3])).toEqual({ ok: false, error });
  });
});

