// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { RazorpayRequestError, createRazorpayOrder, fetchRazorpayPayment } from "@/lib/razorpay-api";

const CONFIG = { keyId: "rzp_test_1", keySecret: "secret", webhookSecret: null };
const ORDER = { amountCents: 300000, currency: "INR", receipt: "entry-1", notes: { entryId: "entry-1" } };

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchRazorpayPayment", () => {
  const payment = { id: "pay_123", order_id: "order_1", amount: 300000, currency: "INR", status: "captured", captured: true };
  it("looks up the payment server-side without caching", async () => {
    const request = vi.fn().mockResolvedValue(reply(200, payment));
    vi.stubGlobal("fetch", request);
    await expect(fetchRazorpayPayment(CONFIG, "pay_123")).resolves.toEqual(payment);
    expect(request).toHaveBeenCalledWith("https://api.razorpay.com/v1/payments/pay_123", expect.objectContaining({ cache: "no-store", headers: { Authorization: `Basic ${Buffer.from("rzp_test_1:secret").toString("base64")}` } }));
  });
  it("rejects invalid references before making a request", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    await expect(fetchRazorpayPayment(CONFIG, "../orders")).rejects.toThrow(/Invalid payment reference/);
    expect(request).not.toHaveBeenCalled();
  });
  it.each([{ ...payment, id: "pay_other" }, { ...payment, amount: "300000" }, { ...payment, captured: undefined }])("rejects malformed responses", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(200, body)));
    await expect(fetchRazorpayPayment(CONFIG, "pay_123")).rejects.toThrow(/Invalid payment lookup/);
  });
  it("fails closed when Razorpay is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(503, {})));
    await expect(fetchRazorpayPayment(CONFIG, "pay_123")).rejects.toThrow(/503/);
  });
});

describe("createRazorpayOrder", () => {
  it("posts the amount in paise with the key pair and returns the order id", async () => {
    const fetchMock = vi.fn(async () => reply(200, { id: "order_1", status: "created" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createRazorpayOrder(CONFIG, ORDER)).resolves.toBe("order_1");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.razorpay.com/v1/orders");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("rzp_test_1:secret").toString("base64")}`,
    );
    expect(JSON.parse(String(init.body))).toEqual({
      amount: 300000,
      currency: "INR",
      receipt: "entry-1",
      notes: { entryId: "entry-1" },
    });
  });

  it("retries a server error with a warning, then succeeds", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply(502, { error: "bad gateway" }))
      .mockResolvedValueOnce(reply(200, { id: "order_2" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createRazorpayOrder(CONFIG, ORDER)).resolves.toBe("order_2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("does not retry a refused request", async () => {
    const fetchMock = vi.fn(async () => reply(401, { error: { description: "Authentication failed" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createRazorpayOrder(CONFIG, ORDER)).rejects.toBeInstanceOf(RazorpayRequestError);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("raises the last error after three failed attempts", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(createRazorpayOrder(CONFIG, ORDER)).rejects.toThrow("fetch failed");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
