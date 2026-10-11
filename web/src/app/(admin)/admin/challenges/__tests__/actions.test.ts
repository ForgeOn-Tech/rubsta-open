import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), save: vi.fn(), void: vi.fn() }));
vi.mock("@/auth/require", () => ({ requireAdmin: mocks.admin }));
vi.mock("@/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/db/queries", () => ({ getCurrentTournament: () => ({ id: "current" }) }));
vi.mock("@/db/challenges", () => ({ saveChallengeAttempt: mocks.save, voidChallengeAttempt: mocks.void }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { recordAttempt, voidAttempt } from "../actions";
const state = { error: null, savedAt: null, token: "attempt-id" };
beforeEach(() => { vi.resetAllMocks(); mocks.admin.mockResolvedValue({ email: "admin@example.com" }); });
it.each([recordAttempt, voidAttempt])("blocks direct mutation calls without admin access", async action => {
  mocks.admin.mockRejectedValue(new Error("redirect:/home"));
  await expect(action(state, new FormData())).rejects.toThrow("redirect:/home");
  expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.void).not.toHaveBeenCalled();
});
it("uses the authenticated administrator and current tournament", async () => {
  const form = new FormData();
  Object.entries({ player: "player", kind: "serve", score: "120", tournamentId: "forged", admin: "forged" }).forEach(([key,value]) => form.set(key,value));
  const result = await recordAttempt(state, form);
  expect(mocks.save).toHaveBeenCalledWith({}, { id: "attempt-id", tournamentId: "current", userId: "player", kind: "serve", value: "120", admin: "admin@example.com" });
  expect(result.error).toBeNull(); expect(result.token).not.toBe(state.token);
});
it("keeps the retry token on validation failure", async () => {
  mocks.save.mockImplementation(() => { throw new Error("Invalid measurement"); });
  expect(await recordAttempt(state, new FormData())).toEqual({ ...state, error: "Invalid measurement" });
});
