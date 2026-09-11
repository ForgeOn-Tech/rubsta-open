"use client";

import { useActionState } from "react";

import {
  BlockFields,
  CourtSelect,
  TimingFields,
  UmpireSelect,
  type CourtOption,
  type UmpireOption,
} from "./schedule-fields";
import { INITIAL_ACTION_STATE, type FormAction } from "@/lib/form-state";
import type { ScheduleEntry } from "@/lib/schedule";

export interface ScheduleItemEditorProps {
  entry: ScheduleEntry;
  /** "M21" or a session's title, so each button has its own name. */
  name: string;
  first: boolean;
  last: boolean;
  courts: readonly CourtOption[];
  umpires: readonly UmpireOption[];
  action: FormAction;
}

const SMALL_BUTTON = "btn btn-outline h-7 px-2.5 text-[11px]";

/** Admin controls under a card: reorder, remove, edit, and move to another court. */
export function ScheduleItemEditor({
  entry,
  name,
  first,
  last,
  courts,
  umpires,
  action,
}: ScheduleItemEditorProps) {
  const [state, formAction, pending] = useActionState(action, INITIAL_ACTION_STATE);
  const idPrefix = `item-${entry.id}`;

  return (
    <div className="mt-2.5 border-t border-line pt-2.5">
      <form action={formAction} className="flex flex-wrap items-center gap-1.5">
        <input type="hidden" name="itemId" value={entry.id} />
        <button
          type="submit"
          name="intent"
          value="up"
          className={SMALL_BUTTON}
          disabled={pending || first}
          aria-label={`Move ${name} up`}
        >
          Up
        </button>
        <button
          type="submit"
          name="intent"
          value="down"
          className={SMALL_BUTTON}
          disabled={pending || last}
          aria-label={`Move ${name} down`}
        >
          Down
        </button>
        <button
          type="submit"
          name="intent"
          value="remove"
          className={SMALL_BUTTON}
          disabled={pending}
          aria-label={`Remove ${name}`}
        >
          Remove
        </button>
      </form>

      <details className="mt-2">
        <summary className="cursor-pointer text-[12px] font-semibold text-accent">
          Edit <span className="sr-only">{name}</span>
        </summary>
        <form action={formAction} className="mt-2 flex flex-col gap-2">
          <input type="hidden" name="itemId" value={entry.id} />
          <input type="hidden" name="intent" value="save" />
          {entry.kind === "match" ? (
            <>
              <TimingFields
                idPrefix={idPrefix}
                initialTiming={entry.timing}
                initialTime={entry.time ?? ""}
              />
              <UmpireSelect id={`${idPrefix}-umpire`} umpires={umpires} initial={entry.umpireEmail} />
            </>
          ) : (
            <BlockFields
              idPrefix={idPrefix}
              initial={{
                title: entry.title ?? "",
                note: entry.note ?? "",
                time: entry.time ?? "",
                endTime: entry.endTime ?? "",
              }}
            />
          )}
          <button type="submit" className="btn btn-primary h-8 w-fit text-[12px]" disabled={pending}>
            Save
          </button>
        </form>
        <form action={formAction} className="mt-3 flex items-end gap-2">
          <input type="hidden" name="itemId" value={entry.id} />
          <input type="hidden" name="intent" value="court" />
          <CourtSelect
            id={`${idPrefix}-court`}
            label="Move to court"
            courts={courts}
            initial={entry.courtNumber}
          />
          <button type="submit" className="btn btn-outline h-9 text-[12px]" disabled={pending}>
            Move
          </button>
        </form>
      </details>

      {state.error ? (
        <p className="mt-2 text-[12px] text-bad" role="alert">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
