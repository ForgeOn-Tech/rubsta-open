import { describe, expect, it } from "vitest";

import {
  DEFAULT_MATCH_LENGTHS,
  clockOf,
  courtEnd,
  courtTimeline,
  expectedMinutes,
  minutesOf,
  planDay,
  positionForTime,
  scheduleSettingsOf,
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

describe("scheduleSettingsOf", () => {
  it("uses what the last fill saved, and the defaults for anything never saved", () => {
    const none = { scheduleRestMinutes: null, oneSetMinutes: null, eightGamesMinutes: null, bestOfThreeMinutes: null };

    expect(scheduleSettingsOf(none)).toEqual({ restMinutes: 30, lengths: DEFAULT_MATCH_LENGTHS });
    expect(scheduleSettingsOf({ ...none, scheduleRestMinutes: 20, oneSetMinutes: 40 })).toEqual({
      restMinutes: 20,
      lengths: { ...DEFAULT_MATCH_LENGTHS, oneSet: 40 },
    });
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
      latestStart: null,
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
      latestStart: null,
    });

    expect(plan.placed.map((item) => clockOf(item.start))).toEqual(["08:00", "09:15"]);
  });

  it("starts a match only after the matches it waits on, plus rest", () => {
    const plan = planDay({
      courts: courts(3),
      matches: [match("semi", ["a", "b"], 90, []), match("final", ["a", "b", "c", "d"], 90, ["semi"])],
      restMinutes: REST,
      busyUntil: new Map(),
      latestStart: null,
    });

    expect(clockOf(plan.placed[1].start)).toBe("10:00");
  });

  it("leaves out a match whose earlier match is not in the plan", () => {
    const plan = planDay({
      courts: courts(1),
      matches: [match("final", ["a", "b"], 90, ["missing"])],
      restMinutes: REST,
      busyUntil: new Map(),
      latestStart: null,
    });

    expect(plan).toEqual({ placed: [], unplaced: [{ matchId: "final", reason: "waits" }] });
  });

  it("rests players after matches already on the day and rounds starts to five minutes", () => {
    const plan = planDay({
      courts: [{ courtNumber: 1, freeFrom: minutesOf("09:02") }],
      matches: [match("m1", ["a", "b"], 45, [])],
      restMinutes: REST,
      busyUntil: new Map([["a", minutesOf("09:10")]]),
      latestStart: null,
    });

    expect(clockOf(plan.placed[0].start)).toBe("09:40");
  });

  it("leaves off a match that would start after the last start, and anything waiting on it", () => {
    const plan = planDay({
      courts: courts(1),
      matches: [match("m1", ["a", "b"], 60, []), match("m2", ["c", "d"], 60, []), match("final", ["a", "b", "c", "d"], 90, ["m2"])],
      restMinutes: REST,
      busyUntil: new Map(),
      latestStart: minutesOf("08:30"),
    });

    expect(plan.placed.map((item) => item.matchId)).toEqual(["m1"]);
    expect(plan.unplaced).toEqual([
      { matchId: "m2", reason: "late" },
      { matchId: "final", reason: "waits" },
    ]);
  });

  it("fills the morning before an event that starts later takes a court", () => {
    // Arrange: one 14:00 match listed among eight morning matches on 4 courts.
    const morning = Array.from({ length: 8 }, (_unused, index) => match(`os${index}`, [`p${index}a`, `p${index}b`], 45, []));
    const afternoon: PlanMatch = { ...match("w30", ["w1", "w2"], 45, []), readyAt: minutesOf("14:00") };

    // Act
    const plan = planDay({
      courts: courts(4),
      matches: [...morning.slice(0, 2), afternoon, ...morning.slice(2)],
      restMinutes: REST,
      busyUntil: new Map(),
      latestStart: null,
    });

    // Assert
    const startOf = (id: string) => clockOf(plan.placed.find((item) => item.matchId === id)!.start);
    expect(morning.map((item) => startOf(item.id))).toEqual(["08:00", "08:00", "08:00", "08:00", "08:45", "08:45", "08:45", "08:45"]);
    expect(startOf("w30")).toBe("14:00");
  });

  it("places whichever match can start first, keeping the given order on a tie", () => {
    const late: PlanMatch = { ...match("late", ["a", "b"], 45, []), readyAt: minutesOf("10:00") };
    const plan = planDay({
      courts: courts(1),
      matches: [late, match("early1", ["c", "d"], 45, []), match("early2", ["e", "f"], 45, [])],
      restMinutes: REST,
      busyUntil: new Map(),
      latestStart: null,
    });

    expect(plan.placed.map((item) => [item.matchId, clockOf(item.start)])).toEqual([
      ["early1", "08:00"],
      ["early2", "08:45"],
      ["late", "10:00"],
    ]);
  });

  it("needs a court", () => {
    expect(() => planDay({ courts: [], matches: [], restMinutes: REST, busyUntil: new Map(), latestStart: null })).toThrow(/at least one court/);
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

  it("starts a timed morning item at its own time when the fill starts later", () => {
    const afternoon = minutesOf("14:00");
    const end = courtEnd([{ timing: "notBefore", time: "08:00", endTime: null, minutes: 60 }], afternoon);
    expect(clockOf(end ?? 0)).toBe("09:00");
  });

  it("keeps a court busy until a long match ends, past a short session at a fixed time", () => {
    const end = courtEnd(
      [
        { timing: "at", time: "08:00", endTime: null, minutes: 90 },
        { timing: "at", time: "09:00", endTime: "09:15", minutes: null },
      ],
      EIGHT,
    );
    expect(clockOf(end ?? 0)).toBe("09:30");
  });
});

describe("courtTimeline", () => {
  it("gives each item its expected start and finish", () => {
    const spans = courtTimeline(
      [
        { timing: "at", time: "08:00", endTime: null, minutes: 45 },
        { timing: "followOn", time: null, endTime: null, minutes: 45 },
        { timing: "notBefore", time: "10:00", endTime: null, minutes: 90 },
        { timing: "notBefore", time: "11:00", endTime: null, minutes: 45 },
      ],
      EIGHT,
    );

    // The last waits for 11:00 but starts only when the 10:00 match is over.
    expect(spans.map((span) => [clockOf(span.start), clockOf(span.end)])).toEqual([
      ["08:00", "08:45"],
      ["08:45", "09:30"],
      ["10:00", "11:30"],
      ["11:30", "12:15"],
    ]);
  });
});

describe("positionForTime", () => {
  const starts = [minutesOf("08:00"), minutesOf("08:45"), minutesOf("09:30")];

  it("goes before the first item starting at that time or later", () => {
    expect(positionForTime(starts, minutesOf("07:30"))).toBe(0);
    expect(positionForTime(starts, minutesOf("08:45"))).toBe(1);
    expect(positionForTime(starts, minutesOf("09:00"))).toBe(2);
  });

  it("goes last after every start, and first on an empty court", () => {
    expect(positionForTime(starts, minutesOf("12:00"))).toBe(3);
    expect(positionForTime([], minutesOf("12:00"))).toBe(0);
  });
});

describe("validateFillRequest", () => {
  const RAW: RawFillRequest = {
    day: "2026-10-24",
    courts: ["2", "1"],
    startTime: "08:30",
    finishBy: "",
    restMinutes: "30",
    oneSet: "45",
    eightGames: "60",
    bestOfThree: "90",
    rounds: ["OS|Group A"],
    eventStarts: { OS: "", W30: "" },
  };
  const DAYS = ["2026-10-24", "2026-10-25"];

  it("reads a last start", () => {
    expect(validateFillRequest({ ...RAW, finishBy: "18:00" }, DAYS, [1, 2, 3])).toMatchObject({ ok: true, request: { finishBy: "18:00" } });
  });

  it("reads the form, courts in order", () => {
    expect(validateFillRequest(RAW, DAYS, [1, 2, 3])).toEqual({
      ok: true,
      request: {
        day: "2026-10-24",
        courts: [1, 2],
        startTime: "08:30",
        finishBy: null,
        restMinutes: 30,
        lengths: { oneSet: 45, eightGames: 60, bestOfThree: 90 },
        rounds: ["OS|Group A"],
        eventStarts: {},
      },
    });
  });

  it("reads an event's own start, and leaves a blank one to the fill", () => {
    expect(validateFillRequest({ ...RAW, eventStarts: { OS: "", W30: "14:00" } }, DAYS, [1, 2, 3])).toMatchObject({
      ok: true,
      request: { eventStarts: { W30: "14:00" } },
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
    [
      "an event start before the first match",
      { eventStarts: { W30: "08:00" } },
      "Enter the Women's 30+ start as a time at or after the first match, or leave it blank.",
    ],
    [
      "an event start that is not a time",
      { eventStarts: { W30: "2pm" } },
      "Enter the Women's 30+ start as a time at or after the first match, or leave it blank.",
    ],
    ["a last start before the first match", { finishBy: "08:00" }, "The last start must be a time after the first match, or blank."],
    ["a bad last start", { finishBy: "9pm" }, "The last start must be a time after the first match, or blank."],
  ])("refuses %s", (_case, change, error) => {
    expect(validateFillRequest({ ...RAW, ...change }, DAYS, [1, 2, 3])).toEqual({ ok: false, error });
  });
});

