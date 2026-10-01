"use client";

import { useActionState, useState } from "react";

import { type Category } from "@/db/schema";
import { type EntryFormState } from "@/lib/entries";
import { REGISTRATION_OPTIONS, registrationOptionLabel, type RegistrationOptionId } from "@/lib/registration-pricing";
import { registrationPrice } from "@/lib/registration-pricing";
import { formatFee } from "@/lib/format";

const INITIAL_STATE: EntryFormState = { error: null };

export interface EntryFormProps {
  action: (
    previous: EntryFormState,
    formData: FormData,
  ) => Promise<EntryFormState>;
  tournamentId: string;
  enteredCategories: readonly Category[];
  feeCents: Record<Category, number>;
  closesLabel: string;
  paymentsEnabled: boolean;
}

export function EntryForm({
  action,
  tournamentId,
  enteredCategories,
  feeCents,
  closesLabel,
  paymentsEnabled,
}: EntryFormProps) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const options = REGISTRATION_OPTIONS.filter(option => option.categories.every(category => !enteredCategories.includes(category)));
  const [selection, setSelection] = useState<RegistrationOptionId | undefined>(options[0]?.id);
  const selected = options.find(option => option.id === selection);

  if (!selected) {
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
        <legend className="caps">Event or approved combo</legend>
        <div className="card mt-2 divide-y divide-line">
          {REGISTRATION_OPTIONS.map((option) => {
            const available = options.includes(option);
            const hintId = `selection-${option.id}-hint`;
            return (
              <div
                key={option.id}
                className="flex items-center justify-between gap-3 px-4"
              >
                <label
                  className={`flex flex-1 items-center gap-3 py-3.5 text-[14px] font-medium ${
                    available ? "cursor-pointer text-ink" : "text-dim"
                  }`}
                >
                  <input
                    type="radio"
                    name="selection"
                    value={option.id}
                    checked={selection === option.id}
                    disabled={!available}
                    onChange={() => setSelection(option.id)}
                    aria-describedby={hintId}
                    className="h-4 w-4 accent-accent"
                  />
                  {registrationOptionLabel(option.id)}
                </label>
                <span id={hintId} className="mono text-[11px] text-dim">
                  {!available ? "Entered" : (option.categories as readonly Category[]).includes("OD") ? "Partner required" : ""}
                </span>
              </div>
            );
          })}
        </div>
      </fieldset>

      {(selected.categories as readonly Category[]).includes("OD") ? (
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

      {(selected.categories as readonly Category[]).includes("OD") ? (
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
            <div className="caps">{registrationOptionLabel(selected.id)} · Main draw</div>
            <div className="mt-1 text-[12px] text-muted">
              Entry closes {closesLabel}
            </div>
          </div>
          <div className="mono text-right text-[16px] font-semibold">{formatFee(registrationPrice(feeCents, selected.categories), "INR")}</div>
        </div>
        <p className="mt-1 text-[11px] text-muted">Early bird pricing applies through 30 September: ₹200 off one event or ₹500 off an approved combo.</p>

        <div className="mt-4 flex gap-3">
          <button type="submit" className="btn btn-primary w-full" disabled={pending}>
            {pending ? "Submitting…" : paymentsEnabled ? "Continue to payment" : "Submit entry"}
          </button>
        </div>
      </div>
    </form>
  );
}
