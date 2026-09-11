"use client";

import { useActionState, useState } from "react";

import { INITIAL_ACTION_STATE, type FormAction } from "@/lib/form-state";

export interface SeedRow {
  entryId: string;
  label: string;
  bestRanking: string | null;
  seed: number | null;
}

export interface SeedsFormProps {
  category: string;
  entrants: readonly SeedRow[];
  maxSeeds: number;
  /** A published draw keeps its seeds. */
  locked: boolean;
  action: FormAction;
}

export function SeedsForm({ category, entrants, maxSeeds, locked, action }: SeedsFormProps) {
  const [state, formAction, pending] = useActionState(action, INITIAL_ACTION_STATE);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      entrants.map((entrant) => [entrant.entryId, entrant.seed === null ? "" : String(entrant.seed)]),
    ),
  );
  const editable = !locked && maxSeeds > 0;

  return (
    <section aria-labelledby="seeds-heading" className="card">
      <form action={formAction}>
        <input type="hidden" name="category" value={category} />
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line px-4 py-3">
          <h2 id="seeds-heading" className="thead">
            Seeds
          </h2>
          <p className="text-[12px] text-muted">
            {maxSeeds === 0
              ? "This draw is too small for seeds."
              : locked
                ? "The draw is published. Move it back to draft to change seeds."
                : `Up to ${maxSeeds} seeds, numbered from 1. Leave blank for unseeded.`}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="thead px-4 py-2.5 font-normal">
                  Entrant
                </th>
                <th scope="col" className="thead px-4 py-2.5 font-normal">
                  Best ranking
                </th>
                <th scope="col" className="thead w-28 px-4 py-2.5 font-normal">
                  Seed
                </th>
              </tr>
            </thead>
            <tbody>
              {entrants.map((entrant) => {
                const inputId = `seed-${entrant.entryId}`;
                return (
                  <tr key={entrant.entryId} className="border-b border-line last:border-b-0">
                    <th scope="row" className="px-4 py-2 text-left font-medium">
                      {entrant.label}
                    </th>
                    <td className="px-4 py-2 text-muted">{entrant.bestRanking ?? "—"}</td>
                    <td className="px-4 py-1.5">
                      <label htmlFor={inputId} className="sr-only">
                        Seed for {entrant.label}
                      </label>
                      <input
                        id={inputId}
                        name={inputId}
                        type="number"
                        min={1}
                        max={maxSeeds}
                        step={1}
                        inputMode="numeric"
                        className="field mono mt-0 h-9 w-20"
                        value={values[entrant.entryId]}
                        disabled={!editable}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [entrant.entryId]: event.target.value,
                          }))
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
          <div>
            {state.error ? (
              <p className="text-[12px] text-bad" role="alert">
                {state.error}
              </p>
            ) : null}
            {state.savedAt && !state.error ? (
              <p className="text-[12px] text-good" role="status">
                Seeds saved.
              </p>
            ) : null}
          </div>
          <button type="submit" className="btn btn-outline h-8 text-[12px]" disabled={!editable || pending}>
            {pending ? "Saving…" : "Save seeds"}
          </button>
        </div>
      </form>
    </section>
  );
}
