// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  isCheckoutSignatureValid,
  isWebhookSignatureValid,
  orderReceipt,
  paidPaymentFromWebhook,
  razorpayConfig,
} from "@/lib/razorpay";

// Worked out with openssl, not with the code under test:
// printf 'order_test123|pay_test456' | openssl dgst -sha256 -hmac 'test_secret'
const CHECKOUT_SIGNATURE = "80c5e4f6be6e2acc8efac61036a58f99b47ead0f6b93feff0ca5cfd41054f0f0";
// printf '{"event":"payment.captured"}' | openssl dgst -sha256 -hmac 'whsec'
const WEBHOOK_BODY = '{"event":"payment.captured"}';
const WEBHOOK_SIGNATURE = "4673dd707ef4c41b987cb7fefe1583142dc702388c93145b7814b9ad3d3c183e";

const CHECKOUT = { orderId: "order_test123", paymentId: "pay_test456", signature: CHECKOUT_SIGNATURE };

function webhook(event: string, payment: Record<string, unknown> | null): string {
  return JSON.stringify({ event, payload: payment === null ? {} : { payment: { entity: payment } } });
}

describe("razorpayConfig", () => {
  it("turns payments off when neither key is set", () => {
    expect(razorpayConfig({})).toBeNull();
    expect(razorpayConfig({ RAZORPAY_KEY_ID: " ", RAZORPAY_KEY_SECRET: "" })).toBeNull();
  });

  it("reads both keys and an optional webhook secret", () => {
    expect(razorpayConfig({ RAZORPAY_KEY_ID: "rzp_test_1", RAZORPAY_KEY_SECRET: "s" })).toEqual({
      keyId: "rzp_test_1",
      keySecret: "s",
      webhookSecret: null,
    });
    expect(
      razorpayConfig({ RAZORPAY_KEY_ID: "rzp_test_1", RAZORPAY_KEY_SECRET: "s", RAZORPAY_WEBHOOK_SECRET: "w" }),
    ).toMatchObject({ webhookSecret: "w" });
  });

  it("refuses one key without the other", () => {
    expect(() => razorpayConfig({ RAZORPAY_KEY_ID: "rzp_test_1" })).toThrow(/both RAZORPAY_KEY_ID/);
    expect(() => razorpayConfig({ RAZORPAY_KEY_SECRET: "s" })).toThrow(/both RAZORPAY_KEY_ID/);
  });
});

describe("isCheckoutSignatureValid", () => {
  it("accepts Razorpay's signature for the order and payment", () => {
    expect(isCheckoutSignatureValid(CHECKOUT, "test_secret")).toBe(true);
  });

  it("refuses a wrong secret, a swapped payment or a cut signature", () => {
    expect(isCheckoutSignatureValid(CHECKOUT, "other_secret")).toBe(false);
    expect(isCheckoutSignatureValid({ ...CHECKOUT, paymentId: "pay_other" }, "test_secret")).toBe(false);
    expect(isCheckoutSignatureValid({ ...CHECKOUT, signature: CHECKOUT_SIGNATURE.slice(1) }, "test_secret")).toBe(
      false,
    );
    expect(isCheckoutSignatureValid({ ...CHECKOUT, signature: "" }, "test_secret")).toBe(false);
  });
});

describe("isWebhookSignatureValid", () => {
  it("checks the raw body against the webhook secret", () => {
    expect(isWebhookSignatureValid(WEBHOOK_BODY, WEBHOOK_SIGNATURE, "whsec")).toBe(true);
    expect(isWebhookSignatureValid(`${WEBHOOK_BODY} `, WEBHOOK_SIGNATURE, "whsec")).toBe(false);
    expect(isWebhookSignatureValid(WEBHOOK_BODY, WEBHOOK_SIGNATURE, "test_secret")).toBe(false);
  });
});

describe("paidPaymentFromWebhook", () => {
  it("reads the payment from payment.captured and order.paid", () => {
    const payment = { id: "pay_1", order_id: "order_1" };
    expect(paidPaymentFromWebhook(webhook("payment.captured", payment))).toEqual({
      orderId: "order_1",
      paymentId: "pay_1",
    });
    expect(paidPaymentFromWebhook(webhook("order.paid", payment))).toEqual({ orderId: "order_1", paymentId: "pay_1" });
  });

  it("ignores other events", () => {
    expect(paidPaymentFromWebhook(webhook("payment.failed", { id: "pay_1", order_id: "order_1" }))).toBeNull();
    expect(paidPaymentFromWebhook(webhook("refund.created", null))).toBeNull();
  });

  it("refuses a paid event with no order", () => {
    expect(() => paidPaymentFromWebhook(webhook("payment.captured", { id: "pay_1" }))).toThrow(
      "Razorpay payment.captured webhook has no payment id and order id.",
    );
  });
});

describe("orderReceipt", () => {
  it("keeps the receipt within Razorpay's 40 characters", () => {
    expect(orderReceipt("3f2b8c1e-5a7d-4e9b-8c2f-1a6d9e0b4c7a")).toBe("3f2b8c1e-5a7d-4e9b-8c2f-1a6d9e0b4c7a");
    expect(orderReceipt("x".repeat(50))).toHaveLength(40);
  });
});
