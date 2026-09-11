import { describe, expect, it } from "vitest";

import type { Court } from "@/db/schema";
import {
  MAX_BLOCK_TITLE_LENGTH,
  MAX_COURT_NAME_LENGTH,
  MAX_SCHEDULE_DAYS,
  courtColumns,
  courtDetail,
  courtOptionLabel,
  defaultScheduleDay,
  formatScheduleDay,
  hasUnpublishedChanges,
  itemName,
  moveInOrder,
  nextCourtNumber,
  placeLabel,
  playFrom,
  publishedPlaces,
  scheduleDayChoices,
  timingLabel,
  tournamentDays,
  umpireMatchIds,
  validateBlock,
  validateCourt,
  validateTiming,
  venueClock,
  venueDay,
  type PublishedPlace,
  type ScheduleEntry,
} from "@/lib/schedule";
import { MAX_COURT } from "@/lib/score-record";

function entry(overrides: Partial<ScheduleEntry>): ScheduleEntry {
  return {
    id: "item-1",
    day: "2026-09-26",
    courtNumber: 1,
    position: 1,
    kind: "match",
    matchId: "match-1",
    title: null,
    note: null,
    timing: "at",
    time: "11:00",
    endTime: null,
    umpireEmail: null,
    ...overrides,
  };
}

function court(number: number, name: string | null, surface: string | null): Court {
  return { id: `court-${number}`, tournamentId: "t", number, name, surface };
}

describe("tournamentDays", () => {
  it("lists each day from the start to the end date", () => {
    expect(tournamentDays("2026-09-30", "2026-10-02")).toEqual([
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
  });

  it("is empty without a start date", () => {
    expect(tournamentDays(null, "2026-10-02")).toEqual([]);
  });

  it("gives the start date alone when the end date is missing or earlier", () => {
    expect(tournamentDays("2026-09-25", null)).toEqual(["2026-09-25"]);
    expect(tournamentDays("2026-09-25", "2026-09-20")).toEqual(["2026-09-25"]);
  });

  it("stops at the longest schedule", () => {
    expect(tournamentDays("2026-01-01", "2026-12-31")).toHaveLength(MAX_SCHEDULE_DAYS);
  });
});

describe("scheduleDayChoices", () => {
  it("adds days that still have items, in date order, without repeats", () => {
    expect(
      scheduleDayChoices(["2026-09-25", "2026-09-26"], ["2026-09-26", "2026-09-20"]),
    ).toEqual(["2026-09-20", "2026-09-25", "2026-09-26"]);
  });
});

describe("formatScheduleDay", () => {
  it("names the weekday, day and month", () => {
    expect(formatScheduleDay("2026-09-26")).toMatch(/^Sat 26 Sept?$/);
  });

  it("rejects a value that is not a date", () => {
    expect(() => formatScheduleDay("2026-02-30")).toThrow(/not a YYYY-MM-DD date/);
  });
});

describe("hasUnpublishedChanges", () => {
  it("is false for an empty day that was never published", () => {
    expect(hasUnpublishedChanges([], null)).toBe(false);
  });

  it("is true for items on a day that was never published", () => {
    expect(hasUnpublishedChanges([entry({})], null)).toBe(true);
  });

  it("ignores the order the items arrive in", () => {
    const first = entry({ id: "a", position: 1 });
    const second = entry({ id: "b", position: 2, matchId: "match-2" });

    expect(hasUnpublishedChanges([second, first], [first, second])).toBe(false);
  });

  it("sees a changed time or umpire", () => {
    const published = [entry({})];

    expect(hasUnpublishedChanges([entry({ time: "11:30" })], published)).toBe(true);
    expect(hasUnpublishedChanges([entry({ umpireEmail: "ump@example.com" })], published)).toBe(true);
  });

  it("sees a removed item", () => {
    expect(hasUnpublishedChanges([], [entry({})])).toBe(true);
  });
});

describe("timingLabel", () => {
  it("shows a start time as it is", () => {
    expect(timingLabel(entry({}), null)).toBe("11:00");
  });

  it("marks a not-before time", () => {
    expect(timingLabel(entry({ timing: "notBefore", time: "15:30" }), "M21")).toBe(
      "Not before 15:30",
    );
  });

  it("names the item a following match waits for", () => {
    expect(timingLabel(entry({ timing: "followOn", time: null }), "M21")).toBe("After M21");
  });

  it("says the time is to follow for a first item with no time", () => {
    expect(timingLabel(entry({ timing: "followOn", time: null }), null)).toBe("Time to follow");
  });

  it("shows a session's time range", () => {
    expect(timingLabel(entry({ kind: "block", time: "12:00", endTime: "14:00" }), null)).toBe(
      "12:00–14:00",
    );
  });

  it("rejects a timed item without a time", () => {
    expect(() => timingLabel(entry({ time: null }), null)).toThrow(/needs a time/);
  });
});

describe("playFrom", () => {
  it("finds the earliest time on the day", () => {
    const entries = [entry({ time: "13:00" }), entry({ time: null }), entry({ time: "11:00" })];

    expect(playFrom(entries)).toBe("11:00");
  });

  it("is null when nothing has a time", () => {
    expect(playFrom([entry({ timing: "followOn", time: null })])).toBeNull();
  });
});

describe("courtColumns", () => {
  it("gives every court a column, with its items in order", () => {
    const columns = courtColumns(
      [court(2, "Show court", "Hard"), court(1, "Centre", "Hard")],
      [entry({ id: "b", courtNumber: 1, position: 2 }), entry({ id: "a", courtNumber: 1, position: 1 })],
    );

    expect(columns.map((column) => column.number)).toEqual([1, 2]);
    expect(columns[0].items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(columns[1].items).toEqual([]);
  });

  it("keeps items on a court number that no court describes", () => {
    const columns = courtColumns([court(1, null, null)], [entry({ courtNumber: 5 })]);

    expect(columns.map((column) => [column.number, column.court])).toEqual([
      [1, court(1, null, null)],
      [5, null],
    ]);
  });
});

describe("courtDetail", () => {
  it("joins the name and surface", () => {
    expect(courtDetail(court(1, "Centre", "Hard"))).toBe("Centre · Hard");
    expect(courtDetail(court(1, null, "Clay"))).toBe("Clay");
  });

  it("is null for a court with neither, or no court", () => {
    expect(courtDetail(court(1, null, null))).toBeNull();
    expect(courtDetail(null)).toBeNull();
  });
});

describe("nextCourtNumber", () => {
  it("starts at 1 and follows the highest number", () => {
    expect(nextCourtNumber([])).toBe(1);
    expect(nextCourtNumber([{ number: 1 }, { number: 4 }])).toBe(5);
  });

  it("refuses more courts than a score can record", () => {
    expect(() => nextCourtNumber([{ number: MAX_COURT }])).toThrow(/at most/);
  });
});

describe("moveInOrder", () => {
  it("swaps an item with its neighbour", () => {
    expect(moveInOrder(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveInOrder(["a", "b", "c"], "b", "down")).toEqual(["a", "c", "b"]);
  });

  it("leaves the order alone at either end", () => {
    expect(moveInOrder(["a", "b"], "a", "up")).toEqual(["a", "b"]);
    expect(moveInOrder(["a", "b"], "b", "down")).toEqual(["a", "b"]);
  });

  it("rejects an id that is not in the list", () => {
    expect(() => moveInOrder(["a"], "z", "up")).toThrow(/not in this list/);
  });
});

describe("validateCourt", () => {
  it("trims values and stores blanks as null", () => {
    expect(validateCourt({ name: "  Centre ", surface: " " })).toEqual({
      ok: true,
      value: { name: "Centre", surface: null },
    });
  });

  it("rejects a long name", () => {
    const result = validateCourt({ name: "x".repeat(MAX_COURT_NAME_LENGTH + 1), surface: "" });

    expect(result.ok).toBe(false);
  });
});

describe("validateTiming", () => {
  it("keeps the time for a start or not-before time", () => {
    expect(validateTiming({ timing: "notBefore", time: "15:30" })).toEqual({
      ok: true,
      value: { timing: "notBefore", time: "15:30" },
    });
  });

  it("drops the time when following on", () => {
    expect(validateTiming({ timing: "followOn", time: "15:30" })).toEqual({
      ok: true,
      value: { timing: "followOn", time: null },
    });
  });

  it("rejects a missing or invalid time", () => {
    expect(validateTiming({ timing: "at", time: "" })).toEqual({
      ok: false,
      error: "Enter a time such as 11:00.",
    });
    expect(validateTiming({ timing: "at", time: "24:00" }).ok).toBe(false);
  });

  it("rejects an unknown timing", () => {
    expect(validateTiming({ timing: "soon", time: "11:00" }).ok).toBe(false);
  });
});

describe("validateBlock", () => {
  const valid = { title: "Serve Speed Challenge", note: "Walk-up entry", time: "12:00", endTime: "14:00" };

  it("accepts a titled session with a time range", () => {
    expect(validateBlock(valid)).toEqual({ ok: true, value: valid });
  });

  it("allows an empty note and end time", () => {
    expect(validateBlock({ ...valid, note: "", endTime: "" })).toEqual({
      ok: true,
      value: { ...valid, note: null, endTime: null },
    });
  });

  it("needs a title and a start time", () => {
    expect(validateBlock({ ...valid, title: " " }).ok).toBe(false);
    expect(validateBlock({ ...valid, title: "x".repeat(MAX_BLOCK_TITLE_LENGTH + 1) }).ok).toBe(false);
    expect(validateBlock({ ...valid, time: "" }).ok).toBe(false);
  });

  it("rejects an end time at or before the start", () => {
    expect(validateBlock({ ...valid, endTime: "12:00" })).toEqual({
      ok: false,
      error: "The session must end after it starts.",
    });
  });
});

describe("venueDay and venueClock", () => {
  it("use the date and time in India", () => {
    // 20:00 UTC on 25 September is 01:30 IST on 26 September.
    const instant = Date.UTC(2026, 8, 25, 20, 0);

    expect(venueDay(instant)).toBe("2026-09-26");
    expect(venueClock(instant)).toBe("01:30");
  });
});

describe("defaultScheduleDay", () => {
  const days = ["2026-09-25", "2026-09-26"];

  it("picks today while the tournament plays", () => {
    expect(defaultScheduleDay(days, "2026-09-26")).toBe("2026-09-26");
  });

  it("picks the first day on any other date", () => {
    expect(defaultScheduleDay(days, "2026-09-11")).toBe("2026-09-25");
  });

  it("is null with no days", () => {
    expect(defaultScheduleDay([], "2026-09-11")).toBeNull();
  });
});

describe("itemName", () => {
  it("names a match by number and a session by title", () => {
    expect(itemName(entry({}), 21)).toBe("M21");
    expect(itemName(entry({ kind: "block", title: "Serve Speed Challenge" }), null)).toBe(
      "Serve Speed Challenge",
    );
  });

  it("rejects a match without a number", () => {
    expect(() => itemName(entry({}), null)).toThrow(/no match number/);
  });
});

describe("courtOptionLabel", () => {
  it("adds the name when the court has one", () => {
    expect(courtOptionLabel({ number: 1, name: "Centre" })).toBe("Court 1 · Centre");
    expect(courtOptionLabel({ number: 2, name: null })).toBe("Court 2");
  });
});

describe("publishedPlaces", () => {
  const numbers = new Map([
    ["match-1", 21],
    ["match-2", 23],
  ]);

  it("gives each match its day, court and timing, naming the item above", () => {
    const items = [
      entry({ id: "b", matchId: "match-2", position: 2, timing: "followOn", time: null, umpireEmail: "ump@example.com" }),
      entry({ id: "a", matchId: "match-1", position: 1 }),
    ];

    const places = publishedPlaces([{ items }], numbers);

    expect(places.get("match-1")).toEqual({
      day: "2026-09-26",
      courtNumber: 1,
      position: 1,
      timing: "11:00",
      umpireEmail: null,
    });
    expect(places.get("match-2")).toEqual({
      day: "2026-09-26",
      courtNumber: 1,
      position: 2,
      timing: "After M21",
      umpireEmail: "ump@example.com",
    });
  });

  it("does not name an item on another court", () => {
    const items = [
      entry({ id: "a", matchId: "match-1", courtNumber: 1 }),
      entry({ id: "b", matchId: "match-2", courtNumber: 2, timing: "followOn", time: null }),
    ];

    expect(publishedPlaces([{ items }], numbers).get("match-2")?.timing).toBe("Time to follow");
  });

  it("leaves out sessions and matches that no longer exist", () => {
    const items = [
      entry({ id: "s", kind: "block", matchId: null, title: "Serve Speed Challenge", endTime: "14:00" }),
      entry({ id: "gone", matchId: "deleted", position: 2 }),
    ];

    expect([...publishedPlaces([{ items }], numbers).keys()]).toEqual([]);
  });
});

describe("placeLabel", () => {
  it("names the day, court and timing", () => {
    const place: PublishedPlace = {
      day: "2026-09-26",
      courtNumber: 2,
      position: 1,
      timing: "Not before 15:30",
      umpireEmail: null,
    };

    expect(placeLabel(place)).toMatch(/^Sat 26 Sept? · Court 2 · Not before 15:30$/);
  });
});

describe("umpireMatchIds", () => {
  function place(day: string, courtNumber: number, position: number, umpireEmail: string): PublishedPlace {
    return { day, courtNumber, position, timing: "11:00", umpireEmail };
  }

  it("lists an umpire's matches in playing order, whatever the email's case", () => {
    const places = new Map([
      ["late", place("2026-09-27", 1, 1, "ump@example.com")],
      ["court-2", place("2026-09-26", 2, 1, "ump@example.com")],
      ["first", place("2026-09-26", 1, 3, "ump@example.com")],
      ["someone-else", place("2026-09-26", 1, 1, "other@example.com")],
    ]);

    expect(umpireMatchIds(places, " Ump@Example.com ")).toEqual(["first", "court-2", "late"]);
  });
});
