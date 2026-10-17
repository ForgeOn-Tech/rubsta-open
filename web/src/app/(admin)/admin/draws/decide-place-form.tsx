"use client";

import { useActionState } from "react";

import { INITIAL_ACTION_STATE, type FormAction } from "@/lib/form-state";

/** Who takes a group place the standings leave level. */
export function DecidePlaceForm({
  drawId,
  groupNumber,
  place,
  placeLabel,
  candidates,
  action,
}: {
  drawId: string;
  groupNumber: number;
  place: number;
  placeLabel: string;
  candidates: readonly { entryId: string; label: string }[];
  action: FormAction;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_ACTION_STATE);
  const selectId = `decide-${groupNumber}-${place}`;
  return (
    <form action={formAction} className="flex flex-col gap-2 border-t border-line px-4 py-3">
      <input type="hidden" name="drawId" value={drawId} />
      <input type="hidden" name="groupNumber" value={groupNumber} />
      <input type="hidden" name="place" value={place} />
      <label htmlFor={selectId} className="text-[12px]">
        Level on matches, head to head and games. Who is the {placeLabel}?
      </label>
      <div className="flex flex-wrap gap-2">
        <select id={selectId} name="entryId" className="field min-w-0 flex-1" required defaultValue="">
          <option value="" disabled>
            Choose
          </option>
          {candidates.map((candidate) => (
            <option key={candidate.entryId} value={candidate.entryId}>
              {candidate.label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary h-10 text-[12px]" disabled={pending}>
          Send through
        </button>
      </div>
      {state.error ? (
        <p className="text-[12px] text-bad" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
