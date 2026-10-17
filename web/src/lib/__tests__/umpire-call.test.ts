import { describe, expect, it } from "vitest";

import { deriveState, standardFormat, type MatchEvent, type Side } from "@/lib/match";
import { ONE_SET, ONE_SET_DECIDING_POINT } from "@/lib/match-formats";
import { lastEventMessage, pointReasons, reasonChoices, umpireCall } from "@/lib/umpire-call";

const NAMES = { top: "Arjun Mehta", bottom: "Rohan Kulkarni" };

function points(side: Side, count: number): MatchEvent[] {
  return Array.from({ length: count }, () => ({ type: "point", side }) as const);
}

function call(events: MatchEvent[], format = ONE_SET) {
  return umpireCall(deriveState(events, format, "top"), NAMES, format);
}

describe("umpireCall", () => {
  it("calls the server's score first", () => {
    expect(call([])).toEqual({ call: "0–0", detail: null });
    expect(call([...points("bottom", 1), ...points("top", 2)])).toEqual({ call: "30–15", detail: null });
  });

  it("calls deuce, advantage and the deciding point", () => {
    const deuce = [...points("top", 3), ...points("bottom", 3)];
    expect(call(deuce)).toEqual({ call: "Deuce", detail: null });
    expect(call([...deuce, ...points("bottom", 1)])).toEqual({ call: "Advantage", detail: "Rohan Kulkarni" });
    expect(call([...deuce, ...points("bottom", 1), ...points("top", 1)])).toEqual({
      call: "Deciding point",
      detail: "Receiver chooses the side",
    });
    expect(call(deuce, ONE_SET_DECIDING_POINT).call).toBe("Deciding point");
  });

  it("calls a tiebreak with the next server's points first", () => {
    const games = (side: Side) => points(side, 4);
    const sixAll = [0, 1, 2, 3, 4, 5].flatMap(() => [...games("top"), ...games("bottom")]);

    // Top serves the first tiebreak point, then Rohan serves the next two.
    expect(call([...sixAll, ...points("bottom", 2)])).toEqual({ call: "2–0", detail: "Tiebreak to 7" });
  });
});

describe("lastEventMessage", () => {
  const message = (events: MatchEvent[]) => lastEventMessage(events, ONE_SET, "top", NAMES);

  it("says what the last event did", () => {
    expect(message([])).toBeNull();
    expect(message(points("top", 1))).toBe("Point Arjun Mehta");
    expect(message([{ type: "point", side: "bottom", finish: "opponentError" }])).toBe("Point Rohan Kulkarni · Mistake");
    expect(message([{ type: "fault" }])).toBe("Fault · 2nd serve");
    expect(message([{ type: "let" }])).toBe("Let · replay the serve");
    expect(message([{ type: "fault" }, { type: "doubleFault" }])).toBe("Double fault · point Rohan Kulkarni");
  });

  it("names the game and a change of ends after odd games", () => {
    expect(message(points("top", 4))).toBe("Game Arjun Mehta · 1–0 · Change ends");
    expect(message([...points("top", 4), ...points("bottom", 4)])).toBe("Game Rohan Kulkarni · 1–1");
  });

  it("names the set when it ends", () => {
    const format = standardFormat("set");
    expect(lastEventMessage(points("top", 24), format, "top", NAMES)).toBe("Point Arjun Mehta · Set Arjun Mehta 6–0");
  });
});

describe("reasonChoices", () => {
  const reasons = (events: MatchEvent[]) => reasonChoices(events, ONE_SET, "top", NAMES).map((reason) => reason.label);

  it("offers an ace only to the server, then a winner or the other side's mistake", () => {
    expect(reasons(points("top", 1))).toEqual(["Ace by Arjun Mehta", "Winner by Arjun Mehta", "Mistake by Rohan Kulkarni"]);
    expect(reasons(points("bottom", 1))).toEqual(["Winner by Rohan Kulkarni", "Mistake by Arjun Mehta"]);
  });

  it("asks nothing once the point has a reason, or after anything but a point", () => {
    expect(reasons([])).toEqual([]);
    expect(reasons([{ type: "point", side: "top", finish: "winner" }])).toEqual([]);
    expect(reasons([{ type: "fault" }])).toEqual([]);
    expect(reasons([{ type: "fault" }, { type: "doubleFault" }])).toEqual([]);
  });

  it("knows who served a point that ended a game", () => {
    // Top served the first game; the second game's point is served by bottom.
    expect(pointReasons("bottom", "bottom", NAMES)[0].label).toBe("Ace by Rohan Kulkarni");
  });
});
