"use client";

import { useActionState, useState } from "react";

import { INITIAL_ACTION_STATE, type FormAction } from "@/lib/form-state";

export function ChangePartnerForm({ entryId, action }: { entryId: string; action: FormAction }) {
  const [state, formAction, pending] = useActionState(action, INITIAL_ACTION_STATE);
  // Controlled fields: React resets uncontrolled fields after a form action.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-3 border-t border-line pt-3">
      <input type="hidden" name="entryId" value={entryId} />
      <h3 className="caps">Name a different partner</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="caps" htmlFor="newPartnerName">
            Partner name
          </label>
          <input
            id="newPartnerName"
            name="partnerName"
            className="field"
            autoComplete="off"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>
        <div>
          <label className="caps" htmlFor="newPartnerEmail">
            Partner email
          </label>
          <input
            id="newPartnerEmail"
            name="partnerEmail"
            type="email"
            className="field"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
      </div>
      {state.error ? (
        <p className="text-[12px] text-bad" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.savedAt !== null && state.error === null ? (
        <p className="text-[12px] text-good" role="status">
          Partner changed. Send them the new link.
        </p>
      ) : null}
      <button type="submit" className="btn btn-outline w-fit" disabled={pending}>
        {pending ? "Saving…" : "Change partner"}
      </button>
    </form>
  );
}
