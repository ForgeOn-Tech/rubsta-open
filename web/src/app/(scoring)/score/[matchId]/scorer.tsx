"use client";

import { ScoringLink as Link } from "@/components/scoring-link";
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
import { MatchStatsTable } from "@/components/match-stats-table";
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
  type MatchFormat,
  type MatchState,
  type Side,
} from "@/lib/match";
import {
  MAX_COURT,
  formatOfRecord,
  parseDeviceScore,
  type DeviceScore,
  type ScoreRecord,
} from "@/lib/score-record";
import { formatSummary } from "@/lib/match-formats";
import { statRows, statsOfRecord } from "@/lib/match-stats";
import type { CourtOption } from "@/lib/schedule";
import { formatElapsed, situationLabel, type SideLabel } from "@/lib/scoring-display";
import { lastEventMessage, pointReasons, reasonChoices, umpireCall } from "@/lib/umpire-call";
import {
  deviceScoreOf,
  hasUnsavedChanges,
  initialScorerState,
  startedOnOtherRules,
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
  /** The rules the match starts with, from its event and round. */
  format: MatchFormat;
  /** Players of this match who were in another match in progress when the page loaded. */
  busyPlayers: readonly string[];
  initial: MatchSnapshot;
  /** When the server recorded the match as finished, else null. */
  completedAt: number | null;
  retireAction: (matchId: string, retiringSide: Side) => Promise<MatchSnapshot>;
  resetAction: (matchId: string) => Promise<MatchSnapshot>;
}

type MenuChoice = "retire-top" | "retire-bottom" | "reset";

const STORAGE_PREFIX = "tournament-os:score:";
const CLOCK_INTERVAL_MS = 15_000;

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
    formatOfRecord(record),
    record.firstServer,
  );
}

/**
 * Epoch milliseconds, refreshed every `intervalMs`; null until the first tick.
 * While paused it holds the last time it read, so a clock stops where it was.
 */
function useNow(intervalMs: number, paused: boolean): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (paused) return;
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, intervalMs);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [intervalMs, paused]);
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
  format,
  busyPlayers,
  initial,
  completedAt,
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

  // Only the server knows when a match reopened later finished. A match that
  // finishes on this device stops its own clock, in Elapsed below.
  const endedAt = completedAt;

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
      {startedOnOtherRules(state, format) ? (
        <div role="alert" className="flex flex-col gap-3 border-b border-line bg-surface-1 px-5 py-4 text-[13px]">
          <p>
            The rules for this match changed after it was started on this phone, and the score never reached
            the server. Start it again to play: {formatSummary(format)}.
          </p>
          <button type="button" className="btn btn-primary h-10 self-start text-[13px]" onClick={() => dispatch({ type: "startAgain" })}>
            Start again
          </button>
        </div>
      ) : state.error ? (
        <div role="alert" className="flex items-center justify-between gap-3 border-b border-line bg-surface-1 px-5 py-3 text-[13px]">
          <span className="text-bad">Not saved: {state.error}</span>
          <div className="flex flex-none gap-2">
            <button type="button" className="btn btn-outline h-9 text-[12px]" onClick={() => dispatch({ type: "retryNow" })}>
              Try again
            </button>
            {state.serverStarted ? null : (
              <button type="button" className="btn btn-outline h-9 text-[12px]" onClick={() => dispatch({ type: "startAgain" })}>
                Start again
              </button>
            )}
          </div>
        </div>
      ) : null}

      {record === null && !finished && busyPlayers.length > 0 ? (
        <ul role="status" aria-label="Players still on another court" className="flex flex-col gap-1 border-b border-line bg-surface-1 px-5 py-3 text-[13px] text-warn">
          {busyPlayers.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}

      {record === null && !finished ? (
        ready ? (
          <StartForm
            sides={sides}
            court={court}
            courts={courts}
            format={format}
            onStart={(start) =>
              dispatch({
                type: "start",
                record: { ...start, decidingSet: format.decidingSet, format, startedAt: Date.now(), events: [] },
              })
            }
          />
        ) : (
          <p className="m-5 card p-4 text-[13px] text-muted" role="status">
            This match is waiting on an earlier result.
          </p>
        )
      ) : (
        <>
          {match && record && !finished && finalEvent === null ? (
            <CallBoard match={match} sides={sides} format={formatOfRecord(record)} dispatch={dispatch} />
          ) : null}
          {shown && record ? (
            <div className="px-5 pt-3">
              <Scoreboard match={shown} sides={sides} format={formatOfRecord(record)} startedAt={record.startedAt} endedAt={endedAt} />
            </div>
          ) : null}
          {finished ? (
            <Result state={state} record={record} match={match} sides={sides} />
          ) : finalEvent !== null && shown && match ? (
            <FinalConfirmation match={shown} before={match} finalEvent={finalEvent} sides={sides} dispatch={dispatch} />
          ) : match && record ? (
            <Controls record={record} match={match} sides={sides} dispatch={dispatch} />
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
  format,
  onStart,
}: {
  sides: Record<Side, SideLabel>;
  court: number | null;
  courts: readonly CourtOption[];
  format: MatchFormat;
  onStart: (start: Pick<ScoreRecord, "firstServer" | "court">) => void;
}) {
  const courtListed = court === null || courts.some((option) => option.number === court);
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const firstServer = SIDES.find((side) => side === form.get("firstServer"));
    const courtText = String(form.get("court") ?? "").trim();
    const courtNumber = courtText === "" ? null : Number(courtText);
    if (firstServer === undefined) return setError("Choose who serves first.");
    if (courtNumber !== null && !(Number.isInteger(courtNumber) && courtNumber >= 1 && courtNumber <= MAX_COURT)) {
      return setError(`Court must be a whole number from 1 to ${MAX_COURT}, or empty.`);
    }
    setError(null);
    onStart({ firstServer, court: courtNumber });
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
      <div className="card p-4">
        <div className="caps">Format</div>
        <p className="mt-1 text-[14px]">{formatSummary(format)}</p>
      </div>
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

/**
 * Time on court. It counts up while the match is being played, and stops when
 * the match ends: on the server's time for a match opened after it finished,
 * else where the clock stood when the last point went in.
 */
function Elapsed({
  startedAt,
  endedAt,
  running,
}: {
  startedAt: number;
  endedAt: number | null;
  running: boolean;
}) {
  const now = useNow(CLOCK_INTERVAL_MS, !running);
  const at = endedAt ?? now;
  return <>{at === null ? "–:––" : formatElapsed(at - startedAt)}</>;
}

function Scoreboard({
  match,
  sides,
  format,
  startedAt,
  endedAt,
}: {
  match: MatchState;
  sides: Record<Side, SideLabel>;
  format: MatchFormat;
  startedAt: number;
  endedAt: number | null;
}) {
  const finished = match.status === "completed";
  const inMatchTiebreak = match.tiebreak && match.tiebreakTarget === MATCH_TIEBREAK_POINTS;
  const setCount = finished || inMatchTiebreak ? match.sets.length : match.sets.length + 1;
  const scores = setScores(match);
  const situation = situationLabel(match, sides, format);

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
          <Elapsed startedAt={startedAt} endedAt={endedAt} running={!finished} /> elapsed · Game{" "}
          {currentGameNumber(match)}
        </span>
      </div>
    </div>
  );
}

/** Names as the call and messages use them. */
function namesOf(sides: Record<Side, SideLabel>): Record<Side, string> {
  return { top: sides.top.name, bottom: sides.bottom.name };
}

/** The score as the umpire calls it, who is serving, and Undo, always in the same place. */
function CallBoard({
  match,
  sides,
  format,
  dispatch,
}: {
  match: MatchState;
  sides: Record<Side, SideLabel>;
  format: MatchFormat;
  dispatch: Dispatch<ScorerAction>;
}) {
  const { call, detail } = umpireCall(match, namesOf(sides), format);
  return (
    <section aria-label="Call" className="relative flex flex-col items-center gap-1.5 px-5 pb-1 pt-4">
      <button
        type="button"
        className="btn btn-outline absolute right-5 top-3 h-11 px-4 text-[14px]"
        onClick={() => dispatch({ type: "undo" })}
      >
        Undo
      </button>
      <p className={`font-serif font-semibold leading-none ${call.length > 7 ? "text-[38px]" : "text-[64px]"}`}>{call}</p>
      <p className="min-h-5 text-[14px] font-semibold text-accent">{detail ?? ""}</p>
      <p className="flex items-center gap-2 text-[14px]">
        <span>{sides[match.server].name} serving</span>
        {match.faultPending ? (
          <span className="bg-warn px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink">2nd serve</span>
        ) : null}
      </p>
    </section>
  );
}

/** The reasons a point can have, as buttons; choosing one records it and the row goes away. */
function ReasonRow({
  reasons,
  dispatch,
}: {
  reasons: ReturnType<typeof pointReasons>;
  dispatch: Dispatch<ScorerAction>;
}) {
  return (
    <section aria-label="How the point was won" className="card flex flex-col gap-2 p-3">
      <p className="text-[13px] font-semibold">
        How was it won? <span className="font-normal text-muted">Optional</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {reasons.map((reason) => (
          <button
            key={reason.finish}
            type="button"
            className="btn btn-outline h-11 text-[13px]"
            onClick={() => dispatch({ type: "reason", finish: reason.finish })}
          >
            {reason.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function Controls({
  record,
  match,
  sides,
  dispatch,
}: {
  record: ScoreRecord;
  match: MatchState;
  sides: Record<Side, SideLabel>;
  dispatch: Dispatch<ScorerAction>;
}) {
  const format = formatOfRecord(record);
  const reasons = reasonChoices(record.events, format, record.firstServer, namesOf(sides));
  const message = lastEventMessage(record.events, format, record.firstServer, namesOf(sides));
  return (
    <div className="flex flex-col gap-3 px-5 pb-5 pt-3">
      {/* The line stays with the reason row, so "Change ends" shows whether or not a reason is given. */}
      <p aria-live="polite" className="card min-h-11 px-3 py-2.5 text-center text-[14px] font-semibold">
        {message ?? "Tap whoever wins each point."}
      </p>
      {reasons.length > 0 ? <ReasonRow reasons={reasons} dispatch={dispatch} /> : null}
      <div className="grid grid-cols-2 gap-3">
        {SIDES.map((side) => {
          const serving = match.server === side;
          return (
            <button
              key={side}
              type="button"
              aria-label={`Point — ${sides[side].name}${serving ? ", serving" : ""}`}
              onClick={() => dispatch({ type: "score", event: { type: "point", side } })}
              className={`flex min-h-[150px] flex-col items-start justify-between gap-2 p-4 text-left ${
                serving ? "bg-accent text-accent-fg" : "border border-line bg-surface-1 text-ink"
              }`}
            >
              <span className="mono min-h-4 text-[11px] tracking-[0.08em]">{serving ? "SERVING" : ""}</span>
              <span className="font-serif text-[24px] font-semibold leading-tight">{sides[side].name}</span>
              <span className="text-[13px] opacity-85">Tap if they won the point</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="h-16 border-2 border-warn bg-surface-1 text-[18px] font-bold text-ink"
        onClick={() => dispatch({ type: "score", event: { type: match.faultPending ? "doubleFault" : "fault" } })}
      >
        {match.faultPending ? "Fault again = double fault" : "Fault"}
      </button>
      <button
        type="button"
        className="h-11 self-center px-3 text-[14px] text-muted underline"
        onClick={() => dispatch({ type: "score", event: { type: "let" } })}
      >
        Let
      </button>
    </div>
  );
}

function FinalConfirmation({
  match,
  before,
  finalEvent,
  sides,
  dispatch,
}: {
  /** The match with the final point. */
  match: MatchState;
  /** The match before it, which says who served the final point. */
  before: MatchState;
  finalEvent: NonNullable<ScorerState["finalEvent"]>;
  sides: Record<Side, SideLabel>;
  dispatch: Dispatch<ScorerAction>;
}) {
  if (match.winner === null) throw new Error("A final point must decide a winner.");
  const reasons =
    finalEvent.type === "point" && finalEvent.finish === undefined
      ? pointReasons(finalEvent.side, before.server, namesOf(sides))
      : [];
  return (
    <section aria-labelledby="final-heading" className="mx-5 my-4 card flex flex-col gap-3 p-4">
      <h2 id="final-heading" className="text-[16px] font-semibold">
        Game, set and match — {sides[match.winner].name}
      </h2>
      <p className="mono text-[13px] text-muted">{scoreLine(match.sets, match.winner)}</p>
      {reasons.length > 0 ? <ReasonRow reasons={reasons} dispatch={dispatch} /> : null}
      <p className="text-[13px] text-muted">Check the score with both players, then confirm. Nothing is final until you do.</p>
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
  record,
  match,
  sides,
}: {
  state: ScorerState;
  record: ScoreRecord | null;
  match: MatchState | null;
  sides: Record<Side, SideLabel>;
}) {
  const winner = state.winner ?? match?.winner ?? null;
  if (winner === null) throw new Error("A finished match must have a winner.");
  const playedOut = match?.status === "completed";
  const detail = playedOut
    ? scoreLine(match.sets, winner)
    : match === null
      ? "W/O"
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
      {record === null ? null : (
        <div className="mt-3 border-t border-line pt-3">
          <MatchStatsTable
            rows={statRows(statsOfRecord(record))}
            names={{ top: sides.top.name, bottom: sides.bottom.name }}
          />
        </div>
      )}
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
