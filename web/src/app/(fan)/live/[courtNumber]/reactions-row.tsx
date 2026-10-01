"use client";

import { useActionState } from "react";

import { REACTION_KINDS, REACTION_LABELS, type ReactionKind } from "@/db/schema";
import { INITIAL_ACTION_STATE, type FormAction } from "@/lib/form-state";

export interface ReactionsRowProps {
  matchId: string;
  counts: Record<ReactionKind, number>;
  /** What this fan has already sent on this match. Each one is sent once. */
  own: readonly ReactionKind[];
  signedIn: boolean;
  action: FormAction;
}

/** Applause, a great shot and a good ball, counted once per fan per match. */
export function ReactionsRow({ matchId, counts, own, signedIn, action }: ReactionsRowProps) {
  const [state, formAction, pending] = useActionState(action, INITIAL_ACTION_STATE);

  return (
    <section aria-label="Reactions">
      <form action={formAction} className="flex gap-2.5">
        <input type="hidden" name="matchId" value={matchId} />
        {REACTION_KINDS.map((kind) => {
          const sent = own.includes(kind);
          const label = `${REACTION_LABELS[kind]}: ${counts[kind]}`;
          const shell =
            "flex h-12 flex-1 items-center justify-center gap-2 border border-club-mist/25 text-[12px]";
          if (!signedIn) {
            return (
              <span key={kind} className={shell} aria-label={label}>
                <span aria-hidden="true">{REACTION_LABELS[kind]}</span>
                <span className="font-semibold lining-nums" aria-hidden="true">
                  {counts[kind]}
                </span>
              </span>
            );
          }
          return (
            <button
              key={kind}
              type="submit"
              name="kind"
              value={kind}
              disabled={pending || sent}
              aria-pressed={sent}
              aria-label={label}
              className={`${shell} ${sent ? "border-club-lime text-club-lime" : "cursor-pointer hover:border-club-lime"} disabled:cursor-default`}
            >
              <span aria-hidden="true">{REACTION_LABELS[kind]}</span>
              <span className="font-semibold lining-nums" aria-hidden="true">
                {counts[kind]}
              </span>
            </button>
          );
        })}
      </form>
      {state.error ? (
        <p className="mt-2 text-[12px] text-club-lime" role="alert">
          {state.error}
        </p>
      ) : null}
    </section>
  );
}
