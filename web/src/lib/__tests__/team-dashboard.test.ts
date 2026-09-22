import { describe, expect, it } from "vitest";
import { paymentSource, paymentSummary } from "../team-dashboard";

describe("team payment records", () => {
  it("distinguishes manually marked payments and demo checkouts from references", () => {
    expect(paymentSource({ paymentRef: "manual" })).toBe("manual");
    expect(paymentSource({ paymentRef: "razorpay-stub" })).toBe("demo");
    expect(paymentSource({ paymentRef: "pay_123" })).toBe("reference");
    expect(paymentSource({ paymentRef: " " })).toBe("missing");
  });
  it("flags paid entries without real references and references on non-paid entries", () => {
    expect(paymentSummary([
      { status: "paid", paymentRef: null },
      { status: "paid", paymentRef: "razorpay-stub" },
      { status: "paid", paymentRef: "manual" },
      { status: "paid", paymentRef: "pay_123" },
      { status: "confirmed", paymentRef: null },
      { status: "cancelled", paymentRef: "pay_456" },
      { status: "submitted", paymentRef: "pay_789" },
    ])).toEqual({ paid: 4, awaiting: 1, needsReview: 4, cancelledWithReference: 1 });
  });
});
