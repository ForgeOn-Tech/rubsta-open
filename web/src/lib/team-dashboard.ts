import type { Entry } from "@/db/schema";

export const PAYMENT_SOURCES = ["reference", "manual", "demo", "missing"] as const;
export type PaymentSource = typeof PAYMENT_SOURCES[number];
export const PAYMENT_SOURCE_LABELS: Record<PaymentSource, string> = {
  reference: "Reference recorded", manual: "Marked manually", demo: "Demo checkout", missing: "No reference",
};
export function paymentSource(entry: Pick<Entry, "paymentRef">): PaymentSource {
  if (entry.paymentRef === "razorpay-stub") return "demo";
  if (entry.paymentRef === "manual") return "manual";
  return entry.paymentRef?.trim() ? "reference" : "missing";
}
export function paymentSummary(entries: readonly Pick<Entry, "status" | "paymentRef">[]) {
  return {
    paid: entries.filter((entry) => entry.status === "paid").length,
    awaiting: entries.filter((entry) => entry.status === "confirmed").length,
    needsReview: entries.filter((entry) =>
      (entry.status === "paid" && ["missing", "demo"].includes(paymentSource(entry))) ||
      (entry.status !== "paid" && paymentSource(entry) !== "missing"),
    ).length,
    cancelledWithReference: entries.filter((entry) => entry.status === "cancelled" && paymentSource(entry) !== "missing").length,
  };
}
