"use client";

import { useActionState, useState } from "react";

import { CATEGORIES, type Category } from "@/db/schema";
import {
  CATEGORY_LABELS,
  isDoubles,
  type EntryFormState,
} from "@/lib/entries";

const INITIAL_STATE: EntryFormState = { error: null };

export interface EntryFormProps {
  action: (
    previous: EntryFormState,
    formData: FormData,
  ) => Promise<EntryFormState>;
  tournamentId: string;
  enteredCategories: readonly Category[];
  feeLabels: Record<Category, string>;
  closesLabel: string;
  paymentsEnabled: boolean;
}

export function EntryForm({
  action,
  tournamentId,
  enteredCategories,
  feeLabels,
  closesLabel,
  paymentsEnabled,
}: EntryFormProps) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const openCategories = CATEGORIES.filter(
    (value) => !enteredCategories.includes(value),
  );
  const [category, setCategory] = useState<Category | undefined>(
    openCategories[0],
  );

  if (!category) {
    return (
      <p className="card p-4 text-[13px] text-muted" role="status">
        You have entered every event.
      </p>
    );
  }


  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="tournamentId" value={tournamentId} />

      <fieldset>
        <legend className="caps">Event</legend>
        <div className="card mt-2 divide-y divide-line">
          {CATEGORIES.map((value) => {
            const entered = enteredCategories.includes(value);
            const hintId = `category-${value}-hint`;
            return (
              <div
                key={value}
                className="flex items-center justify-between gap-3 px-4"
              >
                <label
                  className={`flex flex-1 items-center gap-3 py-3.5 text-[14px] font-medium ${
                    entered ? "text-dim" : "cursor-pointer text-ink"
                  }`}
                >
                  <input
                    type="radio"
                    name="category"
                    value={value}
                    checked={category === value}
                    disabled={entered}
                    onChange={() => setCategory(value)}
                    aria-describedby={hintId}
                    className="h-4 w-4 accent-accent"
                  />
                  {CATEGORY_LABELS[value]}
                </label>
                <span id={hintId} className="mono text-[11px] text-dim">
                  {entered ? "Entered" : isDoubles(value) ? "Partner required" : ""}
                </span>
              </div>
            );
          })}
        </div>
      </fieldset>

      {isDoubles(category) ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="caps" htmlFor="partnerName">
              Partner name
            </label>
            <input
              id="partnerName"
              name="partnerName"
              className="field"
              autoComplete="off"
              required
            />
          </div>
          <div>
            <label className="caps" htmlFor="partnerEmail">
              Partner email
            </label>
            <input
              id="partnerEmail"
              name="partnerEmail"
              type="email"
              className="field"
              autoComplete="off"
              required
            />
          </div>
        </div>
      ) : null}

      {isDoubles(category) ? (
        <p className="-mt-2 text-[12px] text-muted">
          Your partner signs in with this email to accept. The entry goes into the draw once they
          accept. You pay the fee for the whole team.
        </p>
      ) : null}

      {state.error ? (
        <p className="text-[12px] text-bad" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="caps">{CATEGORY_LABELS[category]} · Main draw</div>
            <div className="mt-1 text-[12px] text-muted">
              Entry closes {closesLabel}
            </div>
          </div>
          <div className="mono text-right text-[22px] font-semibold">{feeLabels[category]}</div>
        </div>

        <div className="mt-4 flex gap-3">
          <button type="submit" className="btn btn-primary w-full" disabled={pending}>
            {pending ? "Submitting…" : paymentsEnabled ? "Continue to payment" : "Submit entry"}
          </button>
        </div>
      </div>
    </form>
  );
}
