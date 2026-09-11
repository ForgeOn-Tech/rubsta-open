import { describe, expect, it } from "vitest";

import {
  MANUAL_PAYMENT_REF,
  actionsFor,
  canTransition,
  isEntryStatus,
  statusUpdate,
} from "@/lib/entry-status";

describe("actionsFor", () => {
  it("offers confirm or cancel for a new entry", () => {
    expect(actionsFor("submitted").map((action) => action.label)).toEqual(["Confirm", "Cancel"]);
  });

  it("offers mark paid after confirmation and reinstate after cancellation", () => {
    expect(actionsFor("confirmed").map((action) => action.to)).toEqual(["paid", "cancelled"]);
    expect(actionsFor("paid").map((action) => action.to)).toEqual(["cancelled"]);
    expect(actionsFor("cancelled").map((action) => action.to)).toEqual(["submitted"]);
  });
});

describe("canTransition", () => {
  it("rejects skipping confirmation or moving backwards", () => {
    expect(canTransition("submitted", "paid")).toBe(false);
    expect(canTransition("paid", "confirmed")).toBe(false);
    expect(canTransition("cancelled", "paid")).toBe(false);
  });
});

describe("statusUpdate", () => {
  it("records a manual payment reference when an admin marks an entry paid", () => {
    expect(statusUpdate({ status: "confirmed", paymentRef: null }, "paid")).toEqual({
      status: "paid",
      paymentRef: MANUAL_PAYMENT_REF,
    });
  });

  it("keeps an existing payment reference", () => {
    expect(statusUpdate({ status: "confirmed", paymentRef: "razorpay-stub" }, "paid")).toEqual({
      status: "paid",
      paymentRef: "razorpay-stub",
    });
    expect(statusUpdate({ status: "paid", paymentRef: "manual" }, "cancelled").paymentRef).toBe(
      "manual",
    );
  });

  it("throws on a transition the workflow does not allow", () => {
    expect(() => statusUpdate({ status: "submitted", paymentRef: null }, "paid")).toThrow(
      "Cannot move an entry from submitted to paid.",
    );
  });
});

describe("isEntryStatus", () => {
  it("accepts known statuses only", () => {
    expect(isEntryStatus("paid")).toBe(true);
    expect(isEntryStatus("refunded")).toBe(false);
    expect(isEntryStatus("")).toBe(false);
  });
});
