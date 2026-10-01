"use client";

import { useActionState, useState } from "react";

import {
  BlockFields,
  CourtSelect,
  TimingFields,
  UmpireSelect,
  type CourtOption,
  type UmpireOption,
} from "./schedule-fields";
import { INITIAL_ACTION_STATE, type FormAction } from "@/lib/form-state";

export interface MatchChoice {
  id: string;
  /** The event, e.g. "Men's singles". */
  group: string;
  label: string;
}

export interface AddToScheduleProps {
  day: string;
  dayLabel: string;
  courts: readonly CourtOption[];
  umpires: readonly UmpireOption[];
  matches: readonly MatchChoice[];
  addMatchAction: FormAction;
  addBlockAction: FormAction;
}

const EMPTY_BLOCK = { title: "", note: "", time: "", endTime: "" };

export function AddToSchedule({
  day,
  dayLabel,
  courts,
  umpires,
  matches,
  addMatchAction,
  addBlockAction,
}: AddToScheduleProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <AddMatchForm
        day={day}
        dayLabel={dayLabel}
        courts={courts}
        umpires={umpires}
        matches={matches}
        action={addMatchAction}
      />
      <AddBlockForm day={day} dayLabel={dayLabel} courts={courts} action={addBlockAction} />
    </div>
  );
}

function AddMatchForm({
  day,
  dayLabel,
  courts,
  umpires,
  matches,
  action,
}: {
  day: string;
  dayLabel: string;
  courts: readonly CourtOption[];
  umpires: readonly UmpireOption[];
  matches: readonly MatchChoice[];
  action: FormAction;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_ACTION_STATE);

  return (
    <section aria-labelledby="add-match-heading" className="card p-4">
      <h2 id="add-match-heading" className="text-[14px] font-semibold">
        Add a match to {dayLabel}
      </h2>
      {matches.length === 0 ? (
        <p className="mt-2 text-[12px] text-muted">
          Every match that needs a court has a place. Matches appear here when a draw is published.
        </p>
      ) : (
        <form action={formAction} className="mt-3 flex flex-col gap-2">
          <input type="hidden" name="day" value={day} />
          {/* A new key after each save empties the fields; an error keeps them. */}
          <NewMatchFields key={state.savedAt ?? 0} courts={courts} umpires={umpires} matches={matches} />
          {state.error ? (
            <p className="text-[12px] text-bad" role="alert">
              {state.error}
            </p>
          ) : null}
          <button type="submit" className="btn btn-primary h-9 w-fit text-[12px]" disabled={pending}>
            {pending ? "Adding…" : "Add match"}
          </button>
        </form>
      )}
    </section>
  );
}

function NewMatchFields({
  courts,
  umpires,
  matches,
}: {
  courts: readonly CourtOption[];
  umpires: readonly UmpireOption[];
  matches: readonly MatchChoice[];
}) {
  const [matchId, setMatchId] = useState("");
  const groups = [...new Set(matches.map((match) => match.group))];

  return (
    <>
      <div>
        <label className="caps" htmlFor="new-item-match">
          Match
        </label>
        <select
          id="new-item-match"
          name="matchId"
          className="field"
          value={matchId}
          onChange={(event) => setMatchId(event.target.value)}
          required
        >
          <option value="">Choose a match</option>
          {groups.map((group) => (
            <optgroup key={group} label={group}>
              {matches
                .filter((match) => match.group === group)
                .map((match) => (
                  <option key={match.id} value={match.id}>
                    {match.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <CourtSelect id="new-item-court" label="Court" courts={courts} initial={null} />
        <UmpireSelect id="new-item-umpire" umpires={umpires} initial={null} />
      </div>
      <TimingFields idPrefix="new-item" initialTiming="at" initialTime="" />
    </>
  );
}

function AddBlockForm({
  day,
  dayLabel,
  courts,
  action,
}: {
  day: string;
  dayLabel: string;
  courts: readonly CourtOption[];
  action: FormAction;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_ACTION_STATE);

  return (
    <section aria-labelledby="add-block-heading" className="card p-4">
      <h2 id="add-block-heading" className="text-[14px] font-semibold">
        Add a session to {dayLabel}
      </h2>
      <p className="mt-1 text-[12px] text-muted">
        For court time that is not a match, such as a Challenge Kit session.
      </p>
      <form action={formAction} className="mt-3 flex flex-col gap-2">
        <input type="hidden" name="day" value={day} />
        <div key={state.savedAt ?? 0} className="flex flex-col gap-2">
          <CourtSelect id="new-block-court" label="Court" courts={courts} initial={null} />
          <BlockFields idPrefix="new-block" initial={EMPTY_BLOCK} />
        </div>
        {state.error ? (
          <p className="text-[12px] text-bad" role="alert">
            {state.error}
          </p>
        ) : null}
        <button type="submit" className="btn btn-primary h-9 w-fit text-[12px]" disabled={pending}>
          {pending ? "Adding…" : "Add session"}
        </button>
      </form>
    </section>
  );
}
