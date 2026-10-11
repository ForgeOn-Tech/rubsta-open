import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), enable: vi.fn(), disable: vi.fn(), current: vi.fn() }));
vi.mock("@/auth/require", () => ({ requireUser: mocks.user }));
vi.mock("@/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/db/player-cards", () => ({ enablePlayerCardShare: mocks.enable, disablePlayerCardShare: mocks.disable, getPlayerCardShare: mocks.current }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { setCardSharing } from "../actions";
beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: "owner" }); mocks.enable.mockReturnValue({ token: "public-token" }); });
it("does not let a submitted user ID choose whose card is shared", async () => {
 const form = new FormData(); form.set("intent", "enable"); form.set("userId", "someone-else");
 expect(await setCardSharing({ token: null, error: null }, form)).toEqual({ token: "public-token", error: null });
 expect(mocks.enable).toHaveBeenCalledWith({}, "owner");
});
it("revokes only the signed-in player's link", async () => {
 const form = new FormData(); form.set("intent", "disable");
 await setCardSharing({ token: "forged", error: null }, form);
 expect(mocks.disable).toHaveBeenCalledWith({}, "owner");
});
it("requires sign-in for sharing changes", async () => {
 mocks.user.mockRejectedValue(new Error("redirect:/signin"));
 await expect(setCardSharing({ token: null, error: null }, new FormData())).rejects.toThrow("redirect:/signin");
 expect(mocks.enable).not.toHaveBeenCalled(); expect(mocks.disable).not.toHaveBeenCalled();
});
