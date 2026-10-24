"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";

import { burstFrom } from "@/components/confetti";
import { REACTION_KINDS, REACTION_LABELS, type ReactionKind } from "@/db/schema";
import { INITIAL_ACTION_STATE, type FormAction } from "@/lib/form-state";
import { signInPathFor } from "@/lib/sign-in-return";

const REACTION_EMOJI: Record<ReactionKind, string> = { clap: "👏", shot: "🔥", ball: "🎾" };
const REACTION_BURST = 10;

export interface ReactionsRowProps {
  matchId: string;
  /** The court this page shows, to come back to after signing in. */
  courtNumber: number;
  counts: Record<ReactionKind, number>;
  /** What this fan has already sent on this match. Each one is sent once. */
  own: readonly ReactionKind[];
  signedIn: boolean;
  action: FormAction;
}

/** Applause, a great shot and a good ball, counted once per fan per match. */
export function ReactionsRow({ matchId, courtNumber, counts, own, signedIn, action }: ReactionsRowProps) {
  const [state, formAction, pending] = useActionState(action, INITIAL_ACTION_STATE);
  const tapped = useRef<{ kind: ReactionKind; button: HTMLButtonElement } | null>(null);

  // Burst from the tapped button once the reaction has saved.
  useEffect(() => {
    if (state.savedAt === null || tapped.current === null) return;
    burstFrom(tapped.current.button, [REACTION_EMOJI[tapped.current.kind]], REACTION_BURST);
  }, [state.savedAt]);

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
              onClick={(event) => {
                tapped.current = { kind, button: event.currentTarget };
              }}
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
      {signedIn ? null : (
        <p className="mt-2 text-[12px]">
          <Link href={signInPathFor(`/live/${courtNumber}`)} className="underline">
            Sign up or sign in
          </Link>{" "}
          to react.
        </p>
      )}
      {state.error ? (
        <p className="mt-2 text-[12px] text-club-lime" role="alert">
          {state.error}
        </p>
      ) : null}
    </section>
  );
}
