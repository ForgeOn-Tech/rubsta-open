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
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<CheckoutResult | null>(null);

  async function finish(result: CheckoutResult) {
    setAwaitingConfirmation(result);
    setState("confirming");
    setError(null);
    try {
      const confirmation = await confirm(entryId, result);
      if (confirmation.error) {
        setError(confirmation.error);
        setState("idle");
        return;
      }
      // Home checks the player's saved entry before showing the welcome confirmation.
      router.replace(`/home?paid=${encodeURIComponent(entryId)}`);
      router.refresh();
    } catch {
      setError("Could not check payment status. Please check again; do not pay again if money left your account.");
      setState("idle");
    }
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
      modal: { ondismiss: () => setState(current => current === "confirming" ? current : "idle") },
    });
    checkout.on("payment.failed", (response) => setError(`Payment failed: ${response.error.description}`));
    checkout.open();
    setState("open");
  }

  async function pay() {
    if (awaitingConfirmation) {
      await finish(awaitingConfirmation);
      return;
    }
    setError(null);
    setState("starting");
    try {
      const started = await start(entryId);
      if (started.error !== null) {
        setError(started.error);
        setState("idle");
        return;
      }
      openCheckout(started.order);
    } catch {
      setError("Checkout could not be opened. Please check your connection and try again.");
      setState("idle");
    }
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
        : awaitingConfirmation ? "Check payment status" : `Pay ${amountLabel}`;

  return (
    <>
      <Script src={CHECKOUT_SCRIPT_URL} strategy="afterInteractive" onReady={() => setScriptReady(true)}
        onError={() => setError("The payment window could not load. Check your connection and reload this page.")} />
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
