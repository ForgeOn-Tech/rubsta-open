"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { StartCheckoutResult } from "./payment-actions";
import type { CheckoutOrder, CheckoutResult } from "@/lib/razorpay";

const CHECKOUT_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";
const MERCHANT_NAME = "Rubsta Open";
const THEME_COLOR = "#294f35";

/** The parts of Razorpay Checkout this page uses. */
interface RazorpayCheckout {
  open(): void;
  on(event: "payment.failed", handler: (response: { error: { description: string } }) => void): void;
}

interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckout;
  }
}

type PayState = "idle" | "starting" | "open" | "confirming";

export interface PayButtonProps {
  entryId: string;
  /** The amount on the button, e.g. "₹4,000". */
  amountLabel: string;
  /** Open Checkout as soon as the script loads, right after the entry is submitted. */
  openOnLoad: boolean;
  start: (entryId: string) => Promise<StartCheckoutResult>;
  confirm: (entryId: string, result: CheckoutResult) => Promise<{ error: string | null }>;
}

/** Pays an entry's fee through Razorpay Checkout. */
export function PayButton({ entryId, amountLabel, openOnLoad, start, confirm }: PayButtonProps) {
  const router = useRouter();
  const [scriptReady, setScriptReady] = useState(false);
  const [state, setState] = useState<PayState>("idle");
  const [error, setError] = useState<string | null>(null);
  const openedOnLoad = useRef(false);

  async function finish(result: CheckoutResult) {
    setState("confirming");
    const confirmation = await confirm(entryId, result);
    if (confirmation.error) {
      setError(confirmation.error);
      setState("idle");
      return;
    }
    // Drop ?pay=1 so a reload does not open Checkout again.
    router.replace(`/register/${entryId}`);
    router.refresh();
  }

  function openCheckout(order: CheckoutOrder) {
    if (!window.Razorpay) throw new Error("Razorpay Checkout script is not loaded.");
    const checkout = new window.Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amountCents,
      currency: order.currency,
      name: MERCHANT_NAME,
      description: order.description,
      prefill: order.prefill,
      theme: { color: THEME_COLOR },
      handler: (response: RazorpaySuccess) =>
        void finish({
          orderId: response.razorpay_order_id,
          paymentId: response.razorpay_payment_id,
          signature: response.razorpay_signature,
        }),
      modal: { ondismiss: () => setState("idle") },
    });
    checkout.on("payment.failed", (response) => setError(`Payment failed: ${response.error.description}`));
    checkout.open();
    setState("open");
  }

  async function pay() {
    setError(null);
    setState("starting");
    const started = await start(entryId);
    if (started.error !== null) {
      setError(started.error);
      setState("idle");
      return;
    }
    openCheckout(started.order);
  }

  useEffect(() => {
    if (!openOnLoad || !scriptReady || openedOnLoad.current) return;
    openedOnLoad.current = true;
    void pay();
    // pay() reads only props and setters; run once when the script is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openOnLoad, scriptReady]);

  const busy = state !== "idle" || !scriptReady;
  const label =
    state === "confirming"
      ? "Confirming payment…"
      : state === "starting" || state === "open"
        ? "Opening checkout…"
        : `Pay ${amountLabel}`;

  return (
    <>
      <Script src={CHECKOUT_SCRIPT_URL} strategy="afterInteractive" onReady={() => setScriptReady(true)} />
      {error ? (
        <p className="text-[12px] text-bad" role="alert">
          {error}
        </p>
      ) : null}
      <button type="button" className="btn btn-primary w-full" onClick={() => void pay()} disabled={busy}>
        {label}
      </button>
    </>
  );
}
