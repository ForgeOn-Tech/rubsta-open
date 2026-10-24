"use client";

import { useActionState, useState } from "react";

import { INITIAL_ACTION_STATE, type FormAction } from "@/lib/form-state";
import { finalScoreEvents, needsTiebreak, paperScoreText, type PaperSet } from "@/lib/manual-score";
import { MAX_PAPER_SETS, paperField } from "@/lib/manual-score-form";
import { SIDES, deriveState, type MatchFormat, type Side } from "@/lib/match";

type Boxes = Record<string, string>;

function whole(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

/** The sets typed so far, stopping at the first set left empty. */
function setsFrom(boxes: Boxes, setCount: number): PaperSet[] {
  const sets: PaperSet[] = [];
  for (let setNumber = 1; setNumber <= setCount; setNumber += 1) {
    const top = whole(boxes[paperField(setNumber, "top")]);
    const bottom = whole(boxes[paperField(setNumber, "bottom")]);
    if (top === null || bottom === null) break;
    const tiebreakTop = whole(boxes[paperField(setNumber, "tiebreak-top")]);
    const tiebreakBottom = whole(boxes[paperField(setNumber, "tiebreak-bottom")]);
    sets.push({
      top,
      bottom,
      tiebreak: tiebreakTop === null || tiebreakBottom === null ? null : { top: tiebreakTop, bottom: tiebreakBottom },
    });
  }
  return sets;
}

/** The final score from a paper sheet, checked here and confirmed before it is saved. */
export function FinalScoreForm({
  matchId,
  names,
  format,
  action,
}: {
  matchId: string;
  names: Record<Side, string>;
  format: MatchFormat;
  action: FormAction;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_ACTION_STATE);
  const [boxes, setBoxes] = useState<Boxes>({});
  const [checking, setChecking] = useState(false);
  const setCount = Math.min(format.setsToWin * 2 - 1, MAX_PAPER_SETS);
  const sets = setsFrom(boxes, setCount);
  const check = finalScoreEvents(sets, format);
  const winner = check.ok ? deriveState(check.events, format, "top").winner : null;

  function box(name: string, label: string) {
    return (
      <input
        id={name}
        name={name}
        aria-label={label}
        type="number"
        inputMode="numeric"
        min={0}
        max={99}
        value={boxes[name] ?? ""}
        onChange={(event) => {
          setChecking(false);
          setBoxes({ ...boxes, [name]: event.target.value });
        }}
        className="field w-16 text-center"
      />
    );
  }

  return (
    <form action={formAction} className="card flex flex-col gap-4 p-4">
      <input type="hidden" name="matchId" value={matchId} />
      <h2 className="text-[15px] font-semibold">Final score</h2>
      {Array.from({ length: setCount }, (_, index) => index + 1).map((setNumber) => {
        const top = whole(boxes[paperField(setNumber, "top")]);
        const bottom = whole(boxes[paperField(setNumber, "bottom")]);
        const decider = format.decidingSet === "matchTiebreak" && setNumber === setCount && setCount > 1;
        const tiebreak = !decider && top !== null && bottom !== null && needsTiebreak(top, bottom, format);
        return (
          <fieldset key={setNumber} className="flex flex-col gap-2">
            <legend className="thead">
              {decider ? `Set ${setNumber}: tiebreak to 10 (points)` : `Set ${setNumber}`}
              {setNumber > format.setsToWin ? " · only if played" : ""}
            </legend>
            {SIDES.map((side) => (
              <div key={side} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-[14px]">{names[side]}</span>
                <span className="flex flex-none items-center gap-2">
                  {box(paperField(setNumber, side), `Set ${setNumber}, ${names[side]}`)}
                  {tiebreak
                    ? box(paperField(setNumber, `tiebreak-${side}`), `Set ${setNumber} tiebreak points, ${names[side]}`)
                    : null}
                </span>
              </div>
            ))}
            {tiebreak ? <p className="text-[12px] text-muted">Second boxes: tiebreak points, e.g. 7 and 5.</p> : null}
          </fieldset>
        );
      })}

      {state.error ? (
        <p className="text-[13px] text-bad" role="alert">
          {state.error}
        </p>
      ) : null}

      {checking && winner !== null ? (
        <div className="flex flex-col gap-2 border border-line p-3" role="status">
          <p className="text-[14px]">
            <strong>{names[winner]}</strong> wins {paperScoreText(sets, format)}
            <span className="text-muted"> ({names.top} first)</span>
          </p>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Saving…" : "Save final score"}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => setChecking(false)} disabled={pending}>
            Change it
          </button>
        </div>
      ) : (
        <>
          {checking && !check.ok ? (
            <p className="text-[13px] text-bad" role="alert">
              {check.error}
            </p>
          ) : null}
          <button type="button" className="btn btn-primary" onClick={() => setChecking(true)}>
            Check score
          </button>
        </>
      )}
    </form>
  );
}

/** One side did not turn up, asked twice: the other side wins and moves on at once. */
export function WalkoverForm({
  matchId,
  names,
  action,
}: {
  matchId: string;
  names: Record<Side, string>;
  action: FormAction;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_ACTION_STATE);
  const [armed, setArmed] = useState<Side | null>(null);

  return (
    <form action={formAction} className="card flex flex-col gap-3 p-4">
      <input type="hidden" name="matchId" value={matchId} />
      <h2 className="text-[15px] font-semibold">Walkover</h2>
      <p className="text-[13px] text-muted">Who did not turn up? The other side wins by walkover.</p>
      {SIDES.map((side) =>
        armed === side ? (
          <button key={side} type="submit" name="absentSide" value={side} className="btn btn-primary" disabled={pending}>
            Tap again: {names[side]} did not play
          </button>
        ) : (
          <button key={side} type="button" className="btn btn-outline" onClick={() => setArmed(side)} disabled={pending}>
            {names[side]} did not play
          </button>
        ),
      )}
      {state.error ? (
        <p className="text-[13px] text-bad" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/** Takes back a typed-in score or walkover, asked twice. */
export function UndoResultForm({ matchId, action }: { matchId: string; action: FormAction }) {
  const [state, formAction, pending] = useActionState(action, INITIAL_ACTION_STATE);
  const [armed, setArmed] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="matchId" value={matchId} />
      {armed ? (
        <button type="submit" className="btn btn-primary" disabled={pending}>
          Tap again to undo this result
        </button>
      ) : (
        <button type="button" className="btn btn-outline" onClick={() => setArmed(true)}>
          Undo this result
        </button>
      )}
      {state.error ? (
        <p className="text-[13px] text-bad" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
