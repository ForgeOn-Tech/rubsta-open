"use client";

import Link from "next/link";
import {
  useEffect,
  useEffectEvent,
  useReducer,
  useState,
  useSyncExternalStore,
  useTransition,
  type Dispatch,
  type FormEvent,
} from "react";

import { saveScore, type SaveOutcome } from "./save-score";
import {
  MATCH_TIEBREAK_POINTS,
  SIDES,
  changeEndsAfterThisGame,
  changeEndsAfterThisPoint,
  currentGameNumber,
  deriveState,
  other,
  pointLabel,
  scoreLine,
  setScores,
  standardFormat,
  type DecidingSet,
  type MatchState,
  type Side,
} from "@/lib/match";
import {
  DECIDING_SETS,
  MAX_COURT,
  parseDeviceScore,
  type DeviceScore,
  type ScoreRecord,
} from "@/lib/score-record";
import type { CourtOption } from "@/lib/schedule";
import { formatElapsed, situationLabel, type SideLabel } from "@/lib/scoring-display";
import {
  deviceScoreOf,
  hasUnsavedChanges,
  initialScorerState,
  pendingSave,
  retryDelayMs,
  scorerReducer,
  type MatchSnapshot,
  type ScorerAction,
  type ScorerState,
} from "@/lib/score-sync";

export interface ScorerProps {
  matchId: string;
  matchNumber: number;
  /** e.g. "Men's singles · Semi-finals" */
  heading: string;
  /** The court the match is on, or its place on the published order of play. */
  court: number | null;
  /** The tournament's courts. With none, the umpire types a court number. */
  courts: readonly CourtOption[];
  sides: Record<Side, SideLabel>;
  /** Both sides are drawn entries, so the match can start. */
  ready: boolean;
  initial: MatchSnapshot;
  retireAction: (matchId: string, retiringSide: Side) => Promise<MatchSnapshot>;
  resetAction: (matchId: string) => Promise<MatchSnapshot>;
}

type MenuChoice = "retire-top" | "retire-bottom" | "reset";

const STORAGE_PREFIX = "tournament-os:score:";
const CLOCK_INTERVAL_MS = 15_000;
const DECIDING_SET_LABELS: Record<DecidingSet, string> = {
  set: "Full third set",
  matchTiebreak: "10-point match tiebreak",
};

function subscribeToNothing(): () => void {
  return () => {};
}

function readDeviceScore(matchId: string): DeviceScore | null {
  const raw = window.localStorage.getItem(STORAGE_PREFIX + matchId);
  if (raw === null) return null;
  try {
    return parseDeviceScore(JSON.parse(raw));
  } catch (error) {
    console.warn(`Ignoring the unreadable score kept for match ${matchId}.`, error);
    return null;
  }
}

function writeDeviceScore(matchId: string, device: DeviceScore | null): void {
  const key = STORAGE_PREFIX + matchId;
  if (device === null) {
    window.localStorage.removeItem(key);
  } else {
    window.localStorage.setItem(key, JSON.stringify(device));
  }
}

function actionForOutcome(revision: number, outcome: SaveOutcome): ScorerAction {
  switch (outcome.kind) {
    case "saved":
      return { type: "saved", revision, match: outcome.match };
    case "conflict":
      return { type: "conflicted", revision, match: outcome.match };
    case "rejected":
      return { type: "rejected", revision, message: outcome.message };
    case "failed":
      return { type: "sendFailed", revision };
  }
}

function deriveMatch(record: ScoreRecord, extra: ScoreRecord["events"]): MatchState {
  return deriveState(
    [...record.events, ...extra],
    standardFormat(record.decidingSet),
    record.firstServer,
  );
}

/** Epoch milliseconds, refreshed every `intervalMs`; null until the first tick. */
function useNow(intervalMs: number): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, intervalMs);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [intervalMs]);
  return now;
}

/**
 * The umpire's scoring screen (design/screens/Scoring.dc.html). It renders on
 * the client only, because the score kept on the device decides what to show.
 */
export function Scorer(props: ScorerProps) {
  const onClient = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  if (!onClient) {
    return (
      <p className="p-5 text-[13px] text-muted" role="status">
        Loading the scoreboard…
      </p>
    );
  }
  return <LiveScorer {...props} />;
}

function LiveScorer({
  matchId,
  matchNumber,
  heading,
  court,
  courts,
  sides,
  ready,
  initial,
  retireAction,
  resetAction,
}: ScorerProps) {
  const [state, dispatch] = useReducer(scorerReducer, initial, (snapshot) =>
    initialScorerState(snapshot, readDeviceScore(matchId)),
  );
  const unsaved = hasUnsavedChanges(state);

  // Keep the record on the device, finished matches too: a page reopened from
  // the offline cache can carry an older score, and this record corrects it.
  useEffect(() => {
    writeDeviceScore(matchId, deviceScoreOf(state));
  }, [matchId, state]);

  const sendNextSave = useEffectEvent(() => {
    const save = pendingSave(state);
    if (save === null) return;
    dispatch({ type: "sendStarted", revision: save.revision });
    void saveScore(matchId, save).then((outcome) =>
      dispatch(actionForOutcome(save.revision, outcome)),
    );
  });
  const nextRevision = pendingSave(state)?.revision ?? null;
  const { failures } = state;
  useEffect(() => {
    if (nextRevision === null) return;
    const timer = window.setTimeout(() => sendNextSave(), retryDelayMs(failures));
    return () => window.clearTimeout(timer);
  }, [nextRevision, failures]);

  useEffect(() => {
    const onOnline = () => dispatch({ type: "online" });
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  const { record, finalEvent } = state;
  const match = record === null ? null : deriveMatch(record, []);
  const shown = record !== null && finalEvent !== null ? deriveMatch(record, [finalEvent]) : match;
  const finished = state.status === "completed" || match?.status === "completed";
  const menuBlocked = unsaved || state.failures > 0 || state.conflict !== null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <header className="border-b border-line bg-surface-1 px-5 pb-4 pt-[18px]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5 text-muted">
            <Link href="/score" aria-label="All matches" className="flex-none text-muted">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
            <span className="eyebrow truncate">
              {(record?.court ?? court) === null ? "No court" : `Court ${record?.court ?? court}`} · M
              {matchNumber}
            </span>
          </div>
          <SyncBadge state={state} />
        </div>
        <h1 className="mt-3 text-[20px] font-semibold tracking-[-0.01em]">{heading}</h1>
      </header>

      {state.conflict ? <ConflictBanner conflict={state.conflict} dispatch={dispatch} /> : null}
      {state.error ? (
        <div role="alert" className="flex items-center justify-between gap-3 border-b border-line bg-surface-1 px-5 py-3 text-[13px]">
          <span className="text-bad">Not saved: {state.error}</span>
          <button type="button" className="btn btn-outline h-9 flex-none text-[12px]" onClick={() => dispatch({ type: "retryNow" })}>
            Try again
          </button>
        </div>
      ) : null}

      {record === null && !finished ? (
        ready ? (
          <StartForm
            sides={sides}
            court={court}
            courts={courts}
            onStart={(start) =>
              dispatch({ type: "start", record: { ...start, startedAt: Date.now(), events: [] } })
            }
          />
        ) : (
          <p className="m-5 card p-4 text-[13px] text-muted" role="status">
            This match is waiting on an earlier result.
          </p>
        )
      ) : (
        <>
          {shown && record ? (
            <div className="px-5 pt-4">
              <Scoreboard match={shown} sides={sides} startedAt={record.startedAt} />
            </div>
          ) : null}
          {finished ? (
            <Result state={state} match={match} sides={sides} />
          ) : finalEvent !== null && shown ? (
            <FinalConfirmation match={shown} sides={sides} dispatch={dispatch} />
          ) : match ? (
            <Controls match={match} sides={sides} dispatch={dispatch} />
          ) : null}
        </>
      )}

      {!finished && ready ? (
        <footer className="mt-auto flex items-start justify-between gap-3 border-t border-line bg-surface-1 px-5 pb-[22px] pt-3.5">
          <span className="mono pt-0.5 text-[11px] uppercase text-muted">
            {match ? endsNote(match) : ""}
          </span>
          <MatchMenu
            matchId={matchId}
            sides={sides}
            started={record !== null}
            blocked={menuBlocked}
            retireAction={retireAction}
            resetAction={resetAction}
            dispatch={dispatch}
          />
        </footer>
      ) : null}
    </div>
  );
}

function endsNote(match: MatchState): string {
  if (match.tiebreak) return changeEndsAfterThisPoint(match) ? "Change ends after this point" : "";
  return changeEndsAfterThisGame(match) ? "Change ends after this game" : "";
}

function SyncBadge({ state }: { state: ScorerState }) {
  const unsaved = hasUnsavedChanges(state);
  const [label, color] =
    state.conflict !== null
      ? ["Conflict", "text-bad"]
      : state.error !== null
        ? ["Not saved", "text-bad"]
        : unsaved && state.failures > 0
          ? ["Offline · kept on device", "text-warn"]
          : unsaved
            ? ["Saving…", "text-dim"]
            : ["Saved", "text-good"];
  return (
    <span role="status" className={`mono flex-none text-[10px] uppercase ${color}`}>
      {label}
    </span>
  );
}

function ConflictBanner({
  conflict,
  dispatch,
}: {
  conflict: MatchSnapshot;
  dispatch: Dispatch<ScorerAction>;
}) {
  const completed = conflict.status === "completed";
  return (
    <div role="alert" className="flex flex-col gap-3 border-b border-line bg-surface-1 px-5 py-4 text-[13px]">
      <p>
        {completed
          ? "This match was completed on another device."
          : "This match changed on another device since this one last saved."}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary h-10 text-[13px]" onClick={() => dispatch({ type: "replaceWithServer", match: conflict })}>
          Use the saved score
        </button>
        {completed ? null : (
          <button type="button" className="btn btn-outline h-10 text-[13px]" onClick={() => dispatch({ type: "keepDevice" })}>
            Keep this device&apos;s score
          </button>
        )}
      </div>
    </div>
  );
}

function StartForm({
  sides,
  court,
  courts,
  onStart,
}: {
  sides: Record<Side, SideLabel>;
  court: number | null;
  courts: readonly CourtOption[];
  onStart: (start: Pick<ScoreRecord, "firstServer" | "decidingSet" | "court">) => void;
}) {
  const courtListed = court === null || courts.some((option) => option.number === court);
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const firstServer = SIDES.find((side) => side === form.get("firstServer"));
    const decidingSet = DECIDING_SETS.find((value) => value === form.get("decidingSet"));
    const courtText = String(form.get("court") ?? "").trim();
    const courtNumber = courtText === "" ? null : Number(courtText);
    if (firstServer === undefined) return setError("Choose who serves first.");
    if (decidingSet === undefined) return setError("Choose how the deciding set is played.");
    if (courtNumber !== null && !(Number.isInteger(courtNumber) && courtNumber >= 1 && courtNumber <= MAX_COURT)) {
      return setError(`Court must be a whole number from 1 to ${MAX_COURT}, or empty.`);
    }
    setError(null);
    onStart({ firstServer, decidingSet, court: courtNumber });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 px-5 py-5" noValidate>
      <fieldset className="card flex flex-col gap-2 p-4">
        <legend className="caps px-1">Who serves first?</legend>
        {SIDES.map((side) => (
          <label key={side} className="flex items-center gap-3 text-[15px] font-semibold">
            <input type="radio" name="firstServer" value={side} className="h-4 w-4 accent-[var(--color-accent)]" />
            {sides[side].name}
          </label>
        ))}
      </fieldset>
      <fieldset className="card flex flex-col gap-2 p-4">
        <legend className="caps px-1">Deciding set</legend>
        {DECIDING_SETS.map((value) => (
          <label key={value} className="flex items-center gap-3 text-[14px]">
            <input type="radio" name="decidingSet" value={value} defaultChecked={value === "set"} className="h-4 w-4 accent-[var(--color-accent)]" />
            {DECIDING_SET_LABELS[value]}
          </label>
        ))}
      </fieldset>
      {courts.length === 0 ? (
        <label className="caps block">
          Court
          <input name="court" type="number" inputMode="numeric" min={1} max={MAX_COURT} defaultValue={court ?? ""} className="field" />
        </label>
      ) : (
        <label className="caps block">
          Court
          <select name="court" defaultValue={court ?? ""} className="field">
            <option value="">No court</option>
            {courtListed ? null : <option value={court}>Court {court}</option>}
            {courts.map((option) => (
              <option key={option.number} value={option.number}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {error ? (
        <p className="text-[13px] text-bad" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary">
        Start match
      </button>
      <p className="text-[12px] text-muted">
        The match starts on this device straight away. It saves when there is a connection.
      </p>
    </form>
  );
}

function Elapsed({ startedAt }: { startedAt: number }) {
  const now = useNow(CLOCK_INTERVAL_MS);
  return <>{now === null ? "–:––" : formatElapsed(now - startedAt)}</>;
}

function Scoreboard({
  match,
  sides,
  startedAt,
}: {
  match: MatchState;
  sides: Record<Side, SideLabel>;
  startedAt: number;
}) {
  const finished = match.status === "completed";
  const inMatchTiebreak = match.tiebreak && match.tiebreakTarget === MATCH_TIEBREAK_POINTS;
  const setCount = finished || inMatchTiebreak ? match.sets.length : match.sets.length + 1;
  const scores = setScores(match);
  const situation = situationLabel(match, sides);

  return (
    <div className="card px-4 pt-1">
      <table className="w-full table-fixed border-collapse">
        <caption className="sr-only">Score</caption>
        <thead>
          <tr>
            <th scope="col" className="sr-only">
              Player
            </th>
            {Array.from({ length: setCount }, (_, index) => (
              <th key={index} scope="col" className="thead w-[36px] pb-1.5 pt-2 text-center font-normal">
                S{index + 1}
              </th>
            ))}
            {finished ? null : (
              <th scope="col" className="thead w-[48px] pb-1.5 pt-2 text-right font-normal">
                Pts
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {SIDES.map((side) => {
            const serving = !finished && match.server === side;
            return (
              <tr key={side} className="h-14 border-b border-line">
                <th scope="row" className="text-left font-semibold">
                  <span className="flex items-center gap-[11px]">
                    <span aria-hidden="true" className={`h-[7px] w-[7px] flex-none ${serving ? "bg-accent" : ""}`} />
                    <span className="mono w-3 flex-none text-[10px] font-normal text-dim">
                      {sides[side].seed ?? ""}
                    </span>
                    <span className="truncate text-[15px]">{sides[side].name}</span>
                    {serving ? <span className="sr-only">(serving)</span> : null}
                  </span>
                </th>
                {scores[side].slice(0, setCount).map((cell, index) => (
                  <td
                    key={index}
                    className={`mono text-center text-[20px] font-semibold ${index < match.sets.length ? "text-dim" : "text-ink"}`}
                  >
                    {cell}
                  </td>
                ))}
                {finished ? null : (
                  <td className="mono text-right text-[26px] font-semibold text-accent">
                    {pointLabel(match, side)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex items-center justify-between gap-3 py-3">
        <span className="mono text-[11px] uppercase tracking-[0.08em] text-accent">
          {situation ?? ""}
        </span>
        <span className="mono flex-none text-[11px] uppercase text-dim">
          <Elapsed startedAt={startedAt} /> elapsed · Game {currentGameNumber(match)}
        </span>
      </div>
    </div>
  );
}

const SMALL_BUTTON =
  "flex h-[46px] items-center justify-center gap-1.5 border border-line bg-surface-1 text-[12.5px] font-medium text-muted disabled:opacity-50";

function Controls({
  match,
  sides,
  dispatch,
}: {
  match: MatchState;
  sides: Record<Side, SideLabel>;
  dispatch: Dispatch<ScorerAction>;
}) {
  return (
    <div className="flex flex-col gap-[11px] px-5 pb-5 pt-4">
      {SIDES.map((side) => {
        const serving = match.server === side;
        return (
          <button
            key={side}
            type="button"
            onClick={() => dispatch({ type: "score", event: { type: "point", side } })}
            className={`flex h-[70px] items-center justify-between gap-3 px-5 text-left ${
              serving ? "bg-accent text-accent-fg" : "border border-line bg-surface-1 text-ink"
            }`}
          >
            <span className="truncate text-[16px] font-semibold">Point — {sides[side].name}</span>
            {serving ? <span className="mono flex-none text-[11px] tracking-[0.08em]">SERVING</span> : null}
          </button>
        );
      })}
      <div className="grid grid-cols-2 gap-[11px]">
        <button type="button" className={SMALL_BUTTON} disabled={match.faultPending} onClick={() => dispatch({ type: "score", event: { type: "fault" } })}>
          Fault
        </button>
        <button type="button" className={SMALL_BUTTON} onClick={() => dispatch({ type: "score", event: { type: "doubleFault" } })}>
          Double fault
        </button>
        <button type="button" className={SMALL_BUTTON} onClick={() => dispatch({ type: "score", event: { type: "let" } })}>
          Let
        </button>
        <button type="button" className={SMALL_BUTTON} onClick={() => dispatch({ type: "undo" })}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 7v6h6" />
            <path d="M3.5 13a9 9 0 1 0 2.1-5.6L3 10" />
          </svg>
          Undo
        </button>
      </div>
    </div>
  );
}

function FinalConfirmation({
  match,
  sides,
  dispatch,
}: {
  match: MatchState;
  sides: Record<Side, SideLabel>;
  dispatch: Dispatch<ScorerAction>;
}) {
  if (match.winner === null) throw new Error("A final point must decide a winner.");
  return (
    <section aria-labelledby="final-heading" className="mx-5 my-4 card flex flex-col gap-3 p-4">
      <h2 id="final-heading" className="text-[16px] font-semibold">
        Game, set and match — {sides[match.winner].name}
      </h2>
      <p className="mono text-[13px] text-muted">{scoreLine(match.sets, match.winner)}</p>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "confirmFinal" })}>
        Confirm result
      </button>
      <button type="button" className="btn btn-outline" onClick={() => dispatch({ type: "undo" })}>
        Undo last point
      </button>
    </section>
  );
}

function Result({
  state,
  match,
  sides,
}: {
  state: ScorerState;
  match: MatchState | null;
  sides: Record<Side, SideLabel>;
}) {
  const winner = state.winner ?? match?.winner ?? null;
  if (winner === null) throw new Error("A finished match must have a winner.");
  const playedOut = match?.status === "completed";
  const detail = playedOut
    ? scoreLine(match.sets, winner)
    : match === null
      ? "Walkover"
      : `${sides[other(winner)].name} retired · ${scoreLine(match.sets, winner) || "no sets finished"}`;

  return (
    <section aria-labelledby="result-heading" className="mx-5 my-4 card flex flex-col gap-2 p-4">
      <h2 id="result-heading" className="text-[16px] font-semibold">
        {sides[winner].name} wins
      </h2>
      <p className="mono text-[13px] text-muted">{detail}</p>
      <p className="text-[12px] text-muted">
        {hasUnsavedChanges(state) ? "Saving the result…" : "Result saved."}
      </p>
      <Link href="/score" className="btn btn-outline mt-2">
        Back to matches
      </Link>
    </section>
  );
}

function MatchMenu({
  matchId,
  sides,
  started,
  blocked,
  retireAction,
  resetAction,
  dispatch,
}: {
  matchId: string;
  sides: Record<Side, SideLabel>;
  started: boolean;
  blocked: boolean;
  retireAction: ScorerProps["retireAction"];
  resetAction: ScorerProps["resetAction"];
  dispatch: Dispatch<ScorerAction>;
}) {
  const [armed, setArmed] = useState<MenuChoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startAction] = useTransition();

  function choose(choice: MenuChoice) {
    if (armed !== choice) {
      setArmed(choice);
      return;
    }
    setArmed(null);
    setError(null);
    startAction(async () => {
      try {
        const match =
          choice === "reset"
            ? await resetAction(matchId)
            : await retireAction(matchId, choice === "retire-top" ? "top" : "bottom");
        dispatch({ type: "replaceWithServer", match });
      } catch (actionError) {
        console.warn(`"${choice}" failed for match ${matchId}.`, actionError);
        setError("That did not go through. Check the connection and try again.");
      }
    });
  }

  const choices: { choice: MenuChoice; label: string }[] = [
    { choice: "retire-top", label: `${sides.top.name} retires` },
    { choice: "retire-bottom", label: `${sides.bottom.name} retires` },
    ...(started ? [{ choice: "reset" as const, label: "Reset match" }] : []),
  ];

  return (
    <details className="flex-none text-right">
      <summary className="cursor-pointer text-[12.5px] font-semibold text-accent">Match menu</summary>
      <div className="mt-3 flex w-[220px] flex-col gap-2 text-left">
        {blocked ? (
          <p className="text-[12px] text-muted">Retire and reset need a connection and a saved score.</p>
        ) : null}
        {choices.map(({ choice, label }) => (
          <button
            key={choice}
            type="button"
            className="btn btn-outline h-10 text-[13px]"
            disabled={blocked || pending}
            onClick={() => choose(choice)}
          >
            {armed === choice ? `Tap again: ${label}` : label}
          </button>
        ))}
        {error ? (
          <p className="text-[12px] text-bad" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </details>
  );
}
