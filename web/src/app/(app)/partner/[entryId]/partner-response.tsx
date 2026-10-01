"use client";

import { useActionState } from "react";

import { INITIAL_ACTION_STATE, type FormAction } from "@/lib/form-state";

export function PartnerResponse({ entryId, action }: { entryId: string; action: FormAction }) {
  const [state, formAction, pending] = useActionState(action, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="entryId" value={entryId} />
      {state.error ? (
        <p className="text-[12px] text-bad" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button type="submit" name="decision" value="accept" className="btn btn-primary" disabled={pending}>
          Accept
        </button>
        <button type="submit" name="decision" value="decline" className="btn btn-outline" disabled={pending}>
          Decline
        </button>
      </div>
    </form>
  );
}
