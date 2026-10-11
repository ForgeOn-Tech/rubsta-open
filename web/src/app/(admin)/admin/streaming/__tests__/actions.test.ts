import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), save: vi.fn() }));
vi.mock("@/auth/require", () => ({ requireAdmin: mocks.admin }));
vi.mock("@/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/db/queries", () => ({ getCurrentTournament: () => ({ id: "current" }) }));
vi.mock("@/db/broadcasts", () => ({ saveBroadcast: mocks.save }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { saveStream } from "../actions";
const state = { error: null, savedAt: null };
beforeEach(() => vi.resetAllMocks());
it("rejects direct save calls without admin access", async () => {
  mocks.admin.mockRejectedValue(new Error("redirect:/home"));
  await expect(saveStream(state, new FormData())).rejects.toThrow("redirect:/home");
  expect(mocks.save).not.toHaveBeenCalled();
});
it("ignores a forged tournament and uses the current tournament", async () => {
  const form = new FormData();
  Object.entries({ tournamentId: "forged", courtNumber: "1", status: "off", streamUrl: "", replayUrl: "" }).forEach(([key,value]) => form.set(key,value));
  expect((await saveStream(state, form)).error).toBeNull();
  expect(mocks.save).toHaveBeenCalledWith({}, "current", 1, { status: "off", streamUrl: "", replayUrl: "" });
});
it("reports validation failures without reporting a successful save", async () => {
  mocks.save.mockImplementation(() => { throw new Error("Invalid link"); });
  const form = new FormData(); form.set("courtNumber", "1");
  expect(await saveStream(state, form)).toEqual({ error: "Invalid link", savedAt: null });
});
