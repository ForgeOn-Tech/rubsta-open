"use client";

import { useActionState } from "react";

import { INITIAL_ACTION_STATE, type FormAction } from "@/lib/form-state";

export interface PublishDayButtonProps {
  day: string;
  /** The day has been published before. */
  published: boolean;
  /** The working order of play differs from what umpires see. */
  changed: boolean;
  action: FormAction;
}

export function PublishDayButton({ day, published, changed, action }: PublishDayButtonProps) {
  const [state, formAction, pending] = useActionState(action, INITIAL_ACTION_STATE);
  const label = pending
    ? "Publishing…"
    : !published
      ? "Publish schedule"
      : changed
        ? "Publish changes"
        : "Published";

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <input type="hidden" name="day" value={day} />
        <button type="submit" className="btn btn-primary h-8 text-[12px]" disabled={pending || !changed}>
          {label}
        </button>
      </form>
      {state.error ? (
        <p className="text-[12px] text-bad" role="alert">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
