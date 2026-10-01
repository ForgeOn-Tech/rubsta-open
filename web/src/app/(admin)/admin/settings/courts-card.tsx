"use client";

import { useActionState, useState } from "react";

import type { Court } from "@/db/schema";
import { INITIAL_ACTION_STATE, type FormAction } from "@/lib/form-state";
import { MAX_COURT_NAME_LENGTH, MAX_COURT_SURFACE_LENGTH, courtTitle } from "@/lib/schedule";

export interface CourtsCardProps {
  courts: readonly Court[];
  addAction: FormAction;
  updateAction: FormAction;
  deleteAction: FormAction;
}

interface CourtValues {
  name: string;
  surface: string;
  streamUrl: string;
}

const SMALL_BUTTON = "btn h-9 text-[12px]";

/** Courts for the order of play. A court keeps its number for the whole tournament. */
export function CourtsCard({ courts, addAction, updateAction, deleteAction }: CourtsCardProps) {
  return (
    <section aria-labelledby="courts-heading" className="card flex max-w-2xl flex-col gap-4 p-5">
      <div>
        <h2 id="courts-heading" className="text-[15px] font-semibold">
          Courts
        </h2>
        <p className="mt-1 text-[12px] text-muted">
          The order of play lists matches by court. Each court keeps its number, because
          umpires&apos; phones record scores against it. A YouTube link plays in the Fan Zone.
        </p>
      </div>

      {courts.length === 0 ? (
        <p className="text-[13px] text-muted">No courts yet. Add one to build the order of play.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {courts.map((court) => (
            <li key={court.id}>
              <CourtRow court={court} updateAction={updateAction} deleteAction={deleteAction} />
            </li>
          ))}
        </ul>
      )}

      <AddCourtForm action={addAction} />
    </section>
  );
}

function CourtFields({
  idPrefix,
  values,
  onChange,
}: {
  idPrefix: string;
  values: CourtValues;
  onChange: (values: CourtValues) => void;
}) {
  return (
    <>
      <div className="min-w-0 flex-1">
        <label className="caps" htmlFor={`${idPrefix}-name`}>
          Name
        </label>
        <input
          id={`${idPrefix}-name`}
          name="name"
          className="field"
          maxLength={MAX_COURT_NAME_LENGTH}
          placeholder="Centre"
          value={values.name}
          onChange={(event) => onChange({ ...values, name: event.target.value })}
        />
      </div>
      <div className="min-w-0 flex-1">
        <label className="caps" htmlFor={`${idPrefix}-surface`}>
          Surface
        </label>
        <input
          id={`${idPrefix}-surface`}
          name="surface"
          className="field"
          maxLength={MAX_COURT_SURFACE_LENGTH}
          placeholder="Hard"
          value={values.surface}
          onChange={(event) => onChange({ ...values, surface: event.target.value })}
        />
      </div>
      <div className="min-w-0 flex-1">
        <label className="caps" htmlFor={`${idPrefix}-stream`}>
          Stream link
        </label>
        <input
          id={`${idPrefix}-stream`}
          name="streamUrl"
          type="url"
          className="field"
          placeholder="https://www.youtube.com/watch?v=…"
          value={values.streamUrl}
          onChange={(event) => onChange({ ...values, streamUrl: event.target.value })}
        />
      </div>
    </>
  );
}

function CourtRow({
  court,
  updateAction,
  deleteAction,
}: {
  court: Court;
  updateAction: FormAction;
  deleteAction: FormAction;
}) {
  const [updateState, update, updating] = useActionState(updateAction, INITIAL_ACTION_STATE);
  const [deleteState, remove, deleting] = useActionState(deleteAction, INITIAL_ACTION_STATE);
  // Controlled fields: React resets uncontrolled fields after a form action.
  const [values, setValues] = useState<CourtValues>({
    name: court.name ?? "",
    surface: court.surface ?? "",
    streamUrl: court.streamUrl ?? "",
  });
  const title = courtTitle(court.number);
  const error = updateState.error ?? deleteState.error;

  return (
    <div role="group" aria-label={title} className="border border-line bg-surface-0 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <span className="mono w-[64px] flex-none pb-2.5 text-[13px] font-semibold">{title}</span>
        <form action={update} className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
          <input type="hidden" name="courtNumber" value={court.number} />
          <CourtFields idPrefix={`court-${court.number}`} values={values} onChange={setValues} />
          <button type="submit" className={`${SMALL_BUTTON} btn-outline`} disabled={updating}>
            {updating ? "Saving…" : "Save"}
          </button>
        </form>
        <form action={remove}>
          <input type="hidden" name="courtNumber" value={court.number} />
          <button type="submit" className={`${SMALL_BUTTON} btn-outline`} disabled={deleting}>
            Delete
          </button>
        </form>
      </div>
      {error ? (
        <p className="mt-2 text-[12px] text-bad" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function AddCourtForm({ action }: { action: FormAction }) {
  const [state, formAction, pending] = useActionState(action, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-2 border-t border-line pt-4">
      <h3 className="caps">Add a court</h3>
      {/* A new key after each save empties the fields; an error keeps what was typed. */}
      <NewCourtFields key={state.savedAt ?? 0} pending={pending} />
      {state.error ? (
        <p className="text-[12px] text-bad" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function NewCourtFields({ pending }: { pending: boolean }) {
  const [values, setValues] = useState<CourtValues>({ name: "", surface: "", streamUrl: "" });
  return (
    <div className="flex flex-wrap items-end gap-3">
      <CourtFields idPrefix="new-court" values={values} onChange={setValues} />
      <button type="submit" className={`${SMALL_BUTTON} btn-primary`} disabled={pending}>
        {pending ? "Adding…" : "Add court"}
      </button>
    </div>
  );
}
