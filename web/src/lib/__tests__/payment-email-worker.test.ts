// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ deliver: vi.fn(), config: vi.fn(), db: vi.fn() }));
vi.mock("../payment-email-delivery", () => ({ deliverNextPaymentEmail: mocks.deliver, paymentEmailConfig: mocks.config }));
vi.mock("@/db/client", () => ({ getDb: mocks.db }));
import { startPaymentEmailWorker } from "../payment-email-worker";
afterEach(() => {
  const state = globalThis as typeof globalThis & { paymentEmailTimer?: ReturnType<typeof setInterval> };
  clearInterval(state.paymentEmailTimer); delete state.paymentEmailTimer;
  vi.useRealTimers(); vi.resetAllMocks();
});
it("does not open the database or send when disabled", async () => {
  vi.useFakeTimers(); mocks.config.mockReturnValue(null); startPaymentEmailWorker();
  await vi.advanceTimersByTimeAsync(10000);
  expect(mocks.db).not.toHaveBeenCalled(); expect(mocks.deliver).not.toHaveBeenCalled();
});
it("drains queued payments without a page visit and starts only one timer", async () => {
  vi.useFakeTimers(); mocks.config.mockReturnValue({ apiKey: "fake" }); mocks.deliver.mockResolvedValue("accepted");
  startPaymentEmailWorker(); startPaymentEmailWorker(); await vi.advanceTimersByTimeAsync(10000);
  expect(mocks.deliver).toHaveBeenCalledTimes(2);
});
