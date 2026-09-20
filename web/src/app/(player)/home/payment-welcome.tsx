"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** A short welcome after verified payment; the entry stays visible on home. */
export function PaymentWelcome({ name, eventLabel }: { name: string | null; eventLabel: string }) {
  const router = useRouter();
  const [fading, setFading] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const fade = window.setTimeout(() => setFading(true), 4500);
    const dismiss = window.setTimeout(() => {
      setVisible(false);
      router.replace("/home", { scroll: false });
    }, 5200);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(dismiss);
    };
  }, [router]);

  if (!visible) return null;
  return (
    <div role="status" aria-live="polite" aria-atomic="true"
      className={`fixed inset-x-4 top-6 z-50 mx-auto max-w-md rounded-xl bg-club-forest p-6 text-club-mist shadow-xl transition-opacity duration-700 motion-reduce:transition-none ${fading ? "opacity-0" : "opacity-100"}`}>
      <p className="text-[11px] uppercase tracking-[2px]">Payment confirmed</p>
      <p className="mt-2 font-serif text-[30px] leading-tight">Welcome{name ? `, ${name}` : ""}!</p>
      <p className="mt-2 text-[13px]">Your payment for {eventLabel} is complete. See you at Rubsta Open.</p>
    </div>
  );
}
