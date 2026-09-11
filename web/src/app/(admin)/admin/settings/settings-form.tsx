"use client";

import { useActionState, useState } from "react";

import { TOURNAMENT_STATUSES, type TournamentStatus } from "@/db/schema";
import type { SettingsForm as SettingsValues, SettingsFormState } from "@/lib/settings";

const INITIAL_STATE: SettingsFormState = { error: null, savedAt: null };
const STATUS_LABELS: Record<TournamentStatus, string> = {
  open: "Open for entries",
  closed: "Closed to entries",
};

export interface SettingsFormProps {
  tournamentId: string;
  initial: SettingsValues;
  action: (previous: SettingsFormState, formData: FormData) => Promise<SettingsFormState>;
}

export function SettingsForm({ tournamentId, initial, action }: SettingsFormProps) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  // Controlled fields: React resets uncontrolled fields after a form action.
  const [values, setValues] = useState<SettingsValues>(initial);

  function update<Key extends keyof SettingsValues>(key: Key, value: SettingsValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  return (
    <form action={formAction} className="card flex max-w-2xl flex-col gap-5 p-5">
      <input type="hidden" name="tournamentId" value={tournamentId} />

      <div>
        <label className="caps" htmlFor="name">
          Tournament name
        </label>
        <input
          id="name"
          name="name"
          className="field"
          value={values.name}
          onChange={(event) => update("name", event.target.value)}
          required
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="caps" htmlFor="startsOn">
            Start date
          </label>
          <input
            id="startsOn"
            name="startsOn"
            type="date"
            className="field"
            value={values.startsOn}
            onChange={(event) => update("startsOn", event.target.value)}
          />
        </div>
        <div>
          <label className="caps" htmlFor="endsOn">
            End date
          </label>
          <input
            id="endsOn"
            name="endsOn"
            type="date"
            className="field"
            value={values.endsOn}
            onChange={(event) => update("endsOn", event.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="caps" htmlFor="venue">
          Venue
        </label>
        <input
          id="venue"
          name="venue"
          className="field"
          value={values.venue}
          onChange={(event) => update("venue", event.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="caps" htmlFor="entryClosesAt">
            Entries close (IST)
          </label>
          <input
            id="entryClosesAt"
            name="entryClosesAt"
            type="datetime-local"
            className="field"
            value={values.entryClosesAt}
            onChange={(event) => update("entryClosesAt", event.target.value)}
            required
          />
        </div>
        <div>
          <label className="caps" htmlFor="feeRupees">
            Entry fee (₹)
          </label>
          <input
            id="feeRupees"
            name="feeRupees"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            className="field mono"
            value={values.feeRupees}
            onChange={(event) => update("feeRupees", event.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <label className="caps" htmlFor="status">
          Entries
        </label>
        <select
          id="status"
          name="status"
          className="field"
          value={values.status}
          onChange={(event) => update("status", event.target.value)}
        >
          {TOURNAMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-start gap-3 border border-line bg-surface-0 p-3">
        <input
          type="checkbox"
          name="scheduleConfirmed"
          checked={values.scheduleConfirmed}
          onChange={(event) => update("scheduleConfirmed", event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-accent"
          aria-describedby="schedule-confirmed-hint"
        />
        <span>
          <span className="block text-[13px] font-medium">Schedule confirmed</span>
          <span id="schedule-confirmed-hint" className="mt-1 block text-[12px] text-muted">
            Removes the &ldquo;provisional&rdquo; note from player pages. Needs a start date
            and venue.
          </span>
        </span>
      </label>

      {state.error ? (
        <p className="text-[12px] text-bad" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.savedAt && !state.error ? (
        <p className="text-[12px] text-good" role="status">
          Settings saved.
        </p>
      ) : null}

      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}
