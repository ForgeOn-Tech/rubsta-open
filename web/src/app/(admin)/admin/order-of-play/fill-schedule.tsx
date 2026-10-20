"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";

import type { FillState } from "./actions";
import type { FillRound } from "@/db/auto-schedule";
import { DEFAULT_MATCH_LENGTHS, DEFAULT_REST_MINUTES, DEFAULT_START_TIME } from "@/lib/auto-schedule";
import type { CourtOption } from "@/lib/schedule";

type FillAction = (previous: FillState, formData: FormData) => Promise<FillState>;

const EMPTY: FillState = { error: null, preview: null, added: null };
const SMALL_INPUT = "field mono w-24";

/** Each event's earliest stage still to place, ticked to begin with: every group, or the first round. */
function firstRounds(rounds: readonly FillRound[]): Set<string> {
  const eventOf = (round: FillRound) => round.key.split("|")[0];
  const earliest = new Map<string, number>();
  for (const round of rounds) {
    earliest.set(eventOf(round), Math.min(earliest.get(eventOf(round)) ?? round.roundIndex, round.roundIndex));
  }
  return new Set(rounds.filter((round) => round.roundIndex === earliest.get(eventOf(round))).map((round) => round.key));
}

/**
 * Places matches on the day's courts in one go: the organiser chooses the rounds, courts, start
 * time and rest, previews the plan, then adds it. Everything stays a draft until published.
 */
export function FillSchedule({
  day,
  dayLabel,
  courts,
  rounds,
  action,
}: {
  day: string;
  dayLabel: string;
  courts: readonly CourtOption[];
  rounds: readonly FillRound[];
  action: FillAction;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY);
  const [chosen, setChosen] = useState<Set<string>>(() => firstRounds(rounds));
  const shown = state.preview;

  // Submitted by hand so React does not reset the fields after each action: the plan that is
  // added must come from the same choices as the preview on screen.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(event.currentTarget, submitter);
    startTransition(() => formAction(data));
  }

  function toggle(key: string) {
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <details className="card p-5">
      <summary className="cursor-pointer text-[15px] font-semibold">Fill {dayLabel} automatically</summary>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="day" value={day} />
        <p className="text-[12px] text-muted">
          Places the rounds you tick on the courts you tick, earliest first. Nobody plays on two courts at once, and
          everyone gets the rest below between matches. A match that waits on a winner, such as a final, goes after
          the matches that decide who plays. Check the plan, then add it; nothing reaches umpires until you publish.
        </p>

        <fieldset>
          <legend className="caps">Rounds to place</legend>
          {rounds.length === 0 ? (
            <p className="mt-1 text-[13px] text-muted">Every match already has a place.</p>
          ) : (
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {rounds.map((round) => (
                <label key={round.key} className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    name="rounds"
                    value={round.key}
                    checked={chosen.has(round.key)}
                    onChange={() => toggle(round.key)}
                    className="h-4 w-4 accent-accent"
                  />
                  {round.label} <span className="mono text-[11px] text-dim">{round.matchCount}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className="caps">Courts</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            {courts.map((court) => (
              <label key={court.number} className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" name="courts" value={court.number} defaultChecked className="h-4 w-4 accent-accent" />
                {court.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-4">
          <div>
            <label className="caps" htmlFor="fill-start">
              First match
            </label>
            <input id="fill-start" name="startTime" type="time" defaultValue={DEFAULT_START_TIME} className="field mono" required />
          </div>
          <div>
            <label className="caps" htmlFor="fill-rest">
              Rest (min)
            </label>
            <input id="fill-rest" name="restMinutes" type="number" min={0} defaultValue={DEFAULT_REST_MINUTES} className={SMALL_INPUT} required />
          </div>
          <div>
            <label className="caps" htmlFor="fill-one-set">
              One set (min)
            </label>
            <input id="fill-one-set" name="oneSet" type="number" min={10} defaultValue={DEFAULT_MATCH_LENGTHS.oneSet} className={SMALL_INPUT} required />
          </div>
          <div>
            <label className="caps" htmlFor="fill-eight">
              8 games (min)
            </label>
            <input id="fill-eight" name="eightGames" type="number" min={10} defaultValue={DEFAULT_MATCH_LENGTHS.eightGames} className={SMALL_INPUT} required />
          </div>
          <div>
            <label className="caps" htmlFor="fill-best-of-three">
              Best of 3 (min)
            </label>
            <input id="fill-best-of-three" name="bestOfThree" type="number" min={10} defaultValue={DEFAULT_MATCH_LENGTHS.bestOfThree} className={SMALL_INPUT} required />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="submit" name="intent" value="preview" className="btn btn-outline" disabled={pending || chosen.size === 0}>
            {pending ? "Working…" : "Preview"}
          </button>
          {shown !== null && shown.placed.length > 0 ? (
            <button type="submit" name="intent" value="apply" className="btn btn-primary" disabled={pending}>
              Add {shown.placed.length} matches to the order of play
            </button>
          ) : null}
        </div>

        {state.error ? (
          <p className="text-[12px] text-bad" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.added !== null ? (
          <p className="text-[12px] text-good" role="status">
            Added {state.added} matches. Move any of them below, then publish the day.
          </p>
        ) : null}

        {shown === null ? null : (
          <div className="flex flex-col gap-3">
            {shown.placed.length === 0 ? (
              <p className="text-[13px] text-muted">Nothing could be placed.</p>
            ) : (
              <table className="w-full border-collapse text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="thead px-2 py-1.5 font-normal">Court</th>
                    <th scope="col" className="thead px-2 py-1.5 font-normal">Time</th>
                    <th scope="col" className="thead px-2 py-1.5 font-normal">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.placed.map((row) => (
                    <tr key={row.matchId} className="border-b border-line last:border-b-0">
                      <td className="mono px-2 py-1.5">{row.courtNumber}</td>
                      <td className="mono px-2 py-1.5">
                        {row.start}–{row.end}
                      </td>
                      <td className="px-2 py-1.5">{row.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {shown.unplaced.length === 0 ? null : (
              <div>
                <h3 className="caps">Not placed</h3>
                <ul className="mt-1 flex flex-col gap-1 text-[12px] text-warn">
                  {shown.unplaced.map((row) => (
                    <li key={row.label}>
                      {row.label}: {row.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </form>
    </details>
  );
}
