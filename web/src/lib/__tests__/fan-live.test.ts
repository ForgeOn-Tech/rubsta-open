import { describe, expect, it } from "vitest";

import type { ScoringMatchRow } from "@/db/matches";
import type { Court, Match } from "@/db/schema";
import { courtViews, liveOnCourt, nextOnCourt, scoreboard } from "@/lib/fan-live";
import type { MatchEvent, Side } from "@/lib/match";
import type { PublishedPlace } from "@/lib/schedule";

const AT = 1_700_000_000_000;
const POINTS_PER_GAME = 4;
const DAY = "2026-09-25";

function gamesWonBy(side: Side, games: number): MatchEvent[] {
  return Array.from({ length: games * POINTS_PER_GAME }, () => ({ type: "point", side }) as const);
}

function row(id: string, overrides: Partial<Match>): ScoringMatchRow {
  const match: Match = {
    id,
    drawId: "draw-ms",
    matchNumber: 1,
    roundIndex: 1,
    roundName: "Final",
    topSlot: { kind: "entry", entryId: "top-entry" },
    bottomSlot: { kind: "entry", entryId: "bottom-entry" },
    events: [],
    decidingSet: "set",
    firstServer: null,
    status: "scheduled",
    winnerEntryId: null,
    court: null,
    startedAt: null,
    completedAt: null,
    version: 1,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
  return {
    match,
    category: "OS",
    top: { entryId: "top-entry", seed: 1, name: "Y. Malhotra", partnerName: null },
    bottom: { entryId: "bottom-entry", seed: null, name: "G. Pillai", partnerName: null },
  };
}

function place(courtNumber: number, position: number): PublishedPlace {
  return { day: DAY, courtNumber, position, timing: "Not before 15:30", umpireEmail: null };
}

function court(number: number): Court {
  return { id: `court-${number}`, tournamentId: "t1", number, name: null, surface: null, streamUrl: null };
}

describe("scoreboard", () => {
  it("shows names only before a match starts", () => {
    const board = scoreboard(row("m1", {}));

    expect(board.sides.top).toEqual({
      name: "Y. Malhotra",
      seed: 1,
      sets: [],
      point: null,
      serving: false,
      winner: false,
    });
    expect(board).toMatchObject({ summary: null, setNumber: null, predictionsOpen: false });
  });

  it("shows games, the current point and who serves while a match is on", () => {
    const board = scoreboard(
      row("m1", {
        events: [...gamesWonBy("top", 2), { type: "point", side: "bottom" }],
        firstServer: "top",
        status: "in_progress",
        startedAt: AT,
      }),
    );

    expect(board.sides.top).toMatchObject({ sets: ["2"], point: "0", serving: true });
    expect(board.sides.bottom).toMatchObject({ sets: ["0"], point: "15", serving: false });
    expect(board).toMatchObject({ setNumber: 1, predictionsOpen: true, summary: "2–0" });
  });

  it("closes predictions at five games and marks the winner when it is over", () => {
    const late = scoreboard(
      row("m1", { events: gamesWonBy("top", 5), firstServer: "top", status: "in_progress", startedAt: AT }),
    );
    expect(late.predictionsOpen).toBe(false);

    const done = scoreboard(
      row("m1", {
        events: [...gamesWonBy("top", 6), ...gamesWonBy("top", 6)],
        firstServer: "top",
        status: "completed",
        winnerEntryId: "top-entry",
        startedAt: AT,
        completedAt: AT,
      }),
    );

    expect(done.sides.top).toMatchObject({ sets: ["6", "6"], point: null, winner: true });
    expect(done).toMatchObject({ setNumber: null, predictionsOpen: false, summary: "6–0 6–0" });
  });
});

describe("liveOnCourt and nextOnCourt", () => {
  const live = row("live", { status: "in_progress", court: 1, firstServer: "top", startedAt: AT });
  const second = row("second", {});
  const third = row("third", {});
  const otherCourt = row("other", {});
  const rows = [live, second, third, otherCourt];
  const places = new Map([
    ["second", place(1, 3)],
    ["third", place(1, 2)],
    ["other", place(2, 1)],
  ]);

  it("finds the match an umpire started on the court", () => {
    expect(liveOnCourt(rows, 1)?.match.id).toBe("live");
    expect(liveOnCourt(rows, 2)).toBeNull();
  });

  it("takes the next match from the published order of play", () => {
    expect(nextOnCourt(rows, places, 1)?.match.id).toBe("third");
    expect(nextOnCourt(rows, places, 2)?.match.id).toBe("other");
    expect(nextOnCourt(rows, new Map(), 1)).toBeNull();
  });

  it("lists every court with what is on it", () => {
    expect(
      courtViews([court(1), court(2)], rows, places).map((view) => [
        view.court.number,
        view.live?.match.id ?? null,
        view.next?.match.id ?? null,
      ]),
    ).toEqual([
      [1, "live", "third"],
      [2, null, "other"],
    ]);
  });
});
