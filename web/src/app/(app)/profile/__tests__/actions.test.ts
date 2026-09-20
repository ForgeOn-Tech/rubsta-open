import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tournament: { id: "open", status: "open", entryClosesAt: "2099-01-01T00:00:00Z" },
  save: vi.fn(), submit: vi.fn(), played: vi.fn(() => [] as string[]),
}));
vi.mock("@/auth/require", () => ({ requireUser: async () => ({ id: "player", email: "player@example.com" }) }));
vi.mock("@/db/client", () => ({ getDb: () => ({ select: () => ({ from: () => ({ where: () => ({ get: () => mocks.tournament }) }) }) }) }));
vi.mock("@/db/profiles", () => ({ upsertProfile: mocks.save }));
vi.mock("@/db/partners", () => ({ listPlayedCategories: mocks.played }));
vi.mock("../../register/actions", () => ({ submitEntry: mocks.submit }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));

import { saveProfile } from "../actions";

function form(register = true) {
  const data = new FormData();
  Object.entries({ fullName: "Player", dateOfBirth: "2000-01-01", gender: "male", mobile: "9876543210" }).forEach(([k, v]) => data.set(k, v));
  if (register) Object.entries({ intent: "register", tournamentId: "open", category: "OS" }).forEach(([k, v]) => data.set(k, v));
  return data;
}

describe("profile onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tournament.status = "open";
    mocks.played.mockReturnValue([]);
    mocks.submit.mockImplementation(async () => { throw new Error("redirect:/register/entry?pay=1"); });
  });
  it("saves details then delegates directly to the checkout entry action", async () => {
    const data = form();
    await expect(saveProfile({ error: null }, data)).rejects.toThrow("redirect:/register/entry?pay=1");
    expect(mocks.save).toHaveBeenCalledOnce();
    expect(mocks.submit).toHaveBeenCalledWith({ error: null }, data);
  });
  it.each(["", "invalid"])("rejects invalid category %s before saving", async category => {
    const data = form(); data.set("category", category);
    expect((await saveProfile({ error: null }, data)).error).toBeTruthy();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.submit).not.toHaveBeenCalled();
  });
  it("requires doubles partner details", async () => {
    const data = form(); data.set("category", "OD");
    expect((await saveProfile({ error: null }, data)).error).toBeTruthy();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects closed entries", async () => {
    mocks.tournament.status = "closed";
    expect((await saveProfile({ error: null }, form())).error).toBeTruthy();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects duplicate categories", async () => {
    mocks.played.mockReturnValue(["OS"]);
    expect((await saveProfile({ error: null }, form())).error).toBeTruthy();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("profile edits do not enter or open payment", async () => {
    await expect(saveProfile({ error: null }, form(false))).rejects.toThrow("redirect:/home");
    expect(mocks.save).toHaveBeenCalledOnce();
    expect(mocks.submit).not.toHaveBeenCalled();
  });
});
