"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/auth/require";
import { getDb } from "@/db/client";
import {
  PaymentRejectedError,
  getPayableEntry,
  recordOrder,
  recordPayment,
  type PayableEntry,
} from "@/db/payments";
import { payments, profiles } from "@/db/schema";
import { CATEGORY_LABELS } from "@/lib/entries";
import {
  checkoutContact,
  isCheckoutSignatureValid,
  orderReceipt,
  razorpayConfig,
  type CheckoutOrder,
  type CheckoutResult,
} from "@/lib/razorpay";
import { RazorpayRequestError, createRazorpayOrder, fetchRazorpayPayment } from "@/lib/razorpay-api";

export type StartCheckoutResult = { order: CheckoutOrder; error: null } | { order: null; error: string };

const PAYMENTS_OFF = "Payments are not open yet.";
const GATEWAY_DOWN = "We could not reach the payment service. Try again in a minute.";
const GATEWAY_REFUSED = "Payments are not set up correctly. Contact the organisers.";
const UNCONFIRMED =
  "We could not confirm this payment. If money left your account, contact the organisers with your entry reference.";

/** Creates a Razorpay order for the player's unpaid entry, for Checkout to open. */
export async function startCheckout(entryId: string): Promise<StartCheckoutResult> {
  const user = await requireUser();
  const config = razorpayConfig(process.env);
  if (!config) return { order: null, error: PAYMENTS_OFF };

  const database = getDb();
  let payable: PayableEntry;
  try {
    payable = getPayableEntry(database, entryId, user.id);
  } catch (error) {
    if (error instanceof PaymentRejectedError) return { order: null, error: error.message };
    throw error;
  }
  const { entry, entries: payableEntries, tournament, feeCents } = payable;

  let orderId: string;
  try {
    orderId = await createRazorpayOrder(config, {
      amountCents: feeCents,
      currency: tournament.currency,
      receipt: orderReceipt(entry.id),
      notes: { entryId: entry.id, entryCount: String(payableEntries.length) },
    });
  } catch (error) {
    console.error(`Razorpay order for entry ${entry.id} failed.`, error);
    return { order: null, error: error instanceof RazorpayRequestError ? GATEWAY_REFUSED : GATEWAY_DOWN };
  }
  recordOrder(database, {
    entryId: entry.id,
    userId: user.id,
    orderId,
    amountCents: feeCents,
    currency: tournament.currency,
  });

  const profile = database
    .select({ fullName: profiles.fullName, mobile: profiles.mobile })
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .get();
  return {
    error: null,
    order: {
      keyId: config.keyId,
      orderId,
      amountCents: feeCents,
      currency: tournament.currency,
      description: `${payableEntries.map(item => CATEGORY_LABELS[item.category]).join(" + ")} · ${tournament.name}`,
      prefill: { name: profile?.fullName ?? user.name, email: user.email, contact: checkoutContact(profile?.mobile ?? "") },
    },
  };
}

/** Verify ownership, signature, capture, amount and currency before marking paid. */
export async function confirmCheckout(entryId: string, result: CheckoutResult): Promise<{ error: string | null }> {
  const user = await requireUser();
  const config = razorpayConfig(process.env);
  if (!config) return { error: PAYMENTS_OFF };

  const database = getDb();
  const order = database
    .select()
    .from(payments)
    .where(
      and(eq(payments.orderId, result.orderId), eq(payments.entryId, entryId), eq(payments.userId, user.id)),
    )
    .get();
  if (!order || !isCheckoutSignatureValid(result, config.keySecret)) {
    console.error(`Checkout result for entry ${entryId}, order ${result.orderId} failed verification.`);
    return { error: UNCONFIRMED };
  }

  try {
    const payment = await fetchRazorpayPayment(config, result.paymentId);
    if (payment.order_id !== order.orderId || payment.amount !== order.amountCents || payment.currency !== order.currency) {
      return { error: UNCONFIRMED };
    }
    if (payment.status !== "captured" || !payment.captured) {
      return { error: "Payment is not yet captured. Check payment status again shortly; do not pay again." };
    }
    recordPayment(database, {
      orderId: order.orderId, paymentId: payment.id,
      amountCents: payment.amount, currency: payment.currency,
    });
  } catch {
    return { error: UNCONFIRMED };
  }
  revalidatePath(`/register/${entryId}`);
  revalidatePath("/register");
  revalidatePath("/home");
  return { error: null };
}
