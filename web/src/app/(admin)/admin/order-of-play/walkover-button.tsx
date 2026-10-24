"use client";

import { useActionState, useState } from "react";

import { INITIAL_ACTION_STATE, type FormAction } from "@/lib/form-state";
import { SIDES, type Side } from "@/lib/match";

const SMALL_BUTTON = "btn btn-outline h-8 text-[11.5px]";

/** A walkover, asked in two steps: the winner moves on at once. */
export function WalkoverButton({
  matchId,
  names,
  action,
}: {
  matchId: string;
  names: Record<Side, string>;
  action: FormAction;
}) {
  const [asking, setAsking] = useState(false);
  const [state, formAction, pending] = useActionState(action, INITIAL_ACTION_STATE);

  if (!asking) {
    return (
      <button type="button" className={`${SMALL_BUTTON} mt-2`} onClick={() => setAsking(true)}>
        Walkover…
      </button>
    );
  }
  return (
    <form action={formAction} className="mt-2 flex flex-col gap-2 border border-line p-2.5">
      <input type="hidden" name="matchId" value={matchId} />
      <p className="text-[12px]">Who did not play? The other side wins by walkover and moves on at once.</p>
      {SIDES.map((side) => (
        <button key={side} type="submit" name="absentSide" value={side} className={SMALL_BUTTON} disabled={pending}>
          {names[side]} did not play
        </button>
      ))}
      <button type="button" className={SMALL_BUTTON} onClick={() => setAsking(false)} disabled={pending}>
        Cancel
      </button>
      {state.error ? (
        <p className="text-[12px] text-bad" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/** Undoes a walkover or typed-in score, asked in two steps. Possible until the next match starts. */
export function UndoWalkoverButton({ matchId, action }: { matchId: string; action: FormAction }) {
  const [asking, setAsking] = useState(false);
  const [state, formAction, pending] = useActionState(action, INITIAL_ACTION_STATE);

  if (!asking) {
    return (
      <button type="button" className={`${SMALL_BUTTON} mt-2`} onClick={() => setAsking(true)}>
        Undo result…
      </button>
    );
  }
  return (
    <form action={formAction} className="mt-2 flex flex-col gap-2 border border-line p-2.5">
      <input type="hidden" name="matchId" value={matchId} />
      <p className="text-[12px]">The match goes back to be played, and the winner leaves the next round.</p>
      <button type="submit" className={SMALL_BUTTON} disabled={pending}>
        Undo result
      </button>
      <button type="button" className={SMALL_BUTTON} onClick={() => setAsking(false)} disabled={pending}>
        Cancel
      </button>
      {state.error ? (
        <p className="text-[12px] text-bad" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
