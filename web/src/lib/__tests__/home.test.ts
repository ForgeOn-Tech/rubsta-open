import { describe, expect, it } from "vitest";

import { greetingName, initials, nextStep } from "@/lib/home";

const CATEGORY_COUNT = 4;

const base = {
  hasProfile: true,
  entriesOpen: true,
  enteredCount: 0,
  categoryCount: CATEGORY_COUNT,
};

describe("nextStep", () => {
  it("asks for a profile first, whatever the tournament state", () => {
    const withTournament = nextStep({ ...base, hasProfile: false });
    const withoutTournament = nextStep({ ...base, hasProfile: false, entriesOpen: null });

    expect(withTournament.kind).toBe("create-profile");
    expect(withTournament.action).toEqual({ label: "Create profile", href: "/profile" });
    expect(withoutTournament.kind).toBe("create-profile");
  });

  it("offers no action when no tournament exists", () => {
    const step = nextStep({ ...base, entriesOpen: null });

    expect(step.kind).toBe("no-tournament");
    expect(step.action).toBeNull();
  });

  it("points to existing entries once entries close", () => {
    const withEntries = nextStep({ ...base, entriesOpen: false, enteredCount: 1 });
    const withoutEntries = nextStep({ ...base, entriesOpen: false });

    expect(withEntries.kind).toBe("entries-closed");
    expect(withEntries.description).toBe("Your entries are listed below.");
    expect(withEntries.action).toBeNull();
    expect(withoutEntries.description).toBe("Entries for this tournament have closed.");
  });

  it("sends a player with no entries to the entry form", () => {
    const step = nextStep(base);

    expect(step.kind).toBe("enter-first-event");
    expect(step.action).toEqual({ label: "Enter an event", href: "/register" });
  });

  it("counts the events a player can still enter", () => {
    expect(nextStep({ ...base, enteredCount: 1 }).description).toBe(
      "You can enter 3 more events.",
    );
    expect(nextStep({ ...base, enteredCount: 3 }).description).toBe(
      "You can enter 1 more event.",
    );
  });

  it("stops offering entry once every event is entered", () => {
    const step = nextStep({ ...base, enteredCount: CATEGORY_COUNT });

    expect(step.kind).toBe("all-events-entered");
    expect(step.action).toBeNull();
  });
});

describe("greetingName", () => {
  it("uses the first word of the profile name", () => {
    expect(greetingName("  Gaurav   Pillai ", "Demo Player")).toBe("Gaurav");
  });

  it("falls back to the account name without a profile name", () => {
    expect(greetingName(null, "Demo Player")).toBe("Demo");
    expect(greetingName("   ", "Demo Player")).toBe("Demo");
  });

  it("returns null when no name is known", () => {
    expect(greetingName(null, "")).toBeNull();
  });
});

describe("initials", () => {
  it("takes the first and last name", () => {
    expect(initials("Gaurav Pillai")).toBe("GP");
    expect(initials("anna maria lopez")).toBe("AL");
  });

  it("handles a single name and an empty name", () => {
    expect(initials("Cher")).toBe("C");
    expect(initials("  ")).toBe("");
  });
});
