"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { FanPredictionFeed } from "@/lib/fan-feed";
import type { FanScoreboard } from "@/lib/fan-live";
import { PREDICTION_CLOSES_AT_GAMES, PREDICTION_DISCLAIMER } from "@/lib/fan-predictions";
import { INITIAL_ACTION_STATE, type FormAction } from "@/lib/form-state";
import { SIDES, type Side } from "@/lib/match";

export interface PredictionPanelProps {
  matchId: string;
  board: FanScoreboard;
  prediction: FanPredictionFeed;
  signedIn: boolean;
  action: FormAction;
}

/** "Who takes this set?": the vote, the split so far, and what it is worth. */
export function PredictionPanel({ matchId, board, prediction, signedIn, action }: PredictionPanelProps) {
  const [state, formAction, pending] = useActionState(action, INITIAL_ACTION_STATE);

  return (
    <section aria-labelledby="prediction-heading" className="border border-club-mist/25 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="prediction-heading" className="text-[11px] font-medium uppercase tracking-[1.5px]">
          Who takes set {prediction.setNumber}?
        </h2>
        <span className="text-[10px] uppercase tracking-[1.5px] text-club-mist/60">
          {prediction.open ? `Closes at ${PREDICTION_CLOSES_AT_GAMES} games` : "Voting closed"}
        </span>
      </div>

      <form action={formAction} className="mt-3 flex flex-col gap-2.5">
        <input type="hidden" name="matchId" value={matchId} />
        <input type="hidden" name="setNumber" value={prediction.setNumber} />
        {SIDES.map((side) => (
          <PredictionBar
            key={side}
            side={side}
            name={board.sides[side].name}
            share={prediction.tally.share[side]}
            picked={prediction.own === side}
            votable={prediction.open && signedIn}
            pending={pending}
          />
        ))}
      </form>

      <p className="mt-3 text-[11px] leading-relaxed text-club-mist/60">{PREDICTION_DISCLAIMER}</p>

      {state.error ? (
        <p className="mt-2 text-[12px] text-club-lime" role="alert">
          {state.error}
        </p>
      ) : null}

      {signedIn ? null : (
        <p className="mt-2 text-[12px]">
          <Link href="/signin" className="underline">
            Sign in
          </Link>{" "}
          to call the set.
        </p>
      )}
    </section>
  );
}

function PredictionBar({
  side,
  name,
  share,
  picked,
  votable,
  pending,
}: {
  side: Side;
  name: string;
  share: number;
  picked: boolean;
  votable: boolean;
  pending: boolean;
}) {
  const label = (
    <>
      {/* The filled part shows the share of votes; the text sits above it. */}
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 ${picked ? "bg-club-lime/40" : "bg-club-mist/20"}`}
        style={{ width: `${share}%` }}
      />
      <span className="relative flex w-full items-center justify-between gap-3 px-3">
        <span className="min-w-0 truncate text-[14px] font-medium">{name}</span>
        <span className="flex-none text-[14px] font-semibold lining-nums">{share}%</span>
      </span>
    </>
  );
  const shell = "relative flex h-12 items-center overflow-hidden border border-club-mist/25 text-left";

  if (!votable) {
    return (
      <div className={shell} aria-label={`${name}: ${share}%${picked ? ", your pick" : ""}`}>
        {label}
      </div>
    );
  }
  return (
    <button
      type="submit"
      name="side"
      value={side}
      disabled={pending}
      aria-pressed={picked}
      className={`${shell} cursor-pointer hover:border-club-lime disabled:cursor-wait`}
    >
      {label}
    </button>
  );
}
