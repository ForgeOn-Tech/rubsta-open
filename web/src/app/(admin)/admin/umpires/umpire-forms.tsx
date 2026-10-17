"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { INITIAL_ACTION_STATE, type FormAction } from "@/lib/form-state";
import { MAX_UMPIRE_NAME_LENGTH } from "@/lib/umpire-links";

const COPIED_MS = 2000;

export function AddUmpireForm({ action }: { action: FormAction }) {
  const [state, formAction, pending] = useActionState(action, INITIAL_ACTION_STATE);
  const form = useRef<HTMLFormElement>(null);

  // Clear the name once the umpire is added, ready for the next one.
  useEffect(() => {
    if (state.savedAt !== null && state.error === null) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[220px] flex-1">
        <label className="caps" htmlFor="umpire-name">
          Umpire&apos;s name
        </label>
        <input id="umpire-name" name="name" className="field" maxLength={MAX_UMPIRE_NAME_LENGTH} placeholder="Ravi Kumar" required />
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Adding…" : "Add umpire"}
      </button>
      {state.error ? (
        <p className="w-full text-[12px] text-bad" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/** Copies the full link, or opens WhatsApp with it, from the page's own address. */
export function ShareLink({ path, name }: { path: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const url = () => `${window.location.origin}${path}`;

  async function copy() {
    await navigator.clipboard.writeText(url());
    setCopied(true);
    window.setTimeout(() => setCopied(false), COPIED_MS);
  }

  function whatsApp() {
    const text = `Hi ${name}, here is your Rubsta Open scoring link. Open it on your phone and keep it to yourself: ${url()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn btn-outline h-9 text-[12px]" onClick={() => void copy()}>
        {copied ? "Copied" : "Copy link"}
      </button>
      <button type="button" className="btn btn-outline h-9 text-[12px]" onClick={whatsApp}>
        Send on WhatsApp
      </button>
    </div>
  );
}
