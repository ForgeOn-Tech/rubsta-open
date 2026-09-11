import type { Match, MatchStatus } from "@/db/schema";
import { deriveState, standardFormat, type MatchEvent, type Side } from "@/lib/match";
import {
  reconcileScore,
  scoreRecordOf,
  type DeviceScore,
  type ScoreRecord,
} from "@/lib/score-record";

/**
 * Client-side state for the scoring page. The device owns the score record:
 * every tap changes it at once, and saves run in the background, one at a
 * time, retrying after network failures. See lib/score-record for the record.
 */

/** What the scoring page needs to know about the stored match. */
export interface MatchSnapshot {
  version: number;
  status: MatchStatus;
  /** The winning side once completed, including by retirement or a bye. */
  winner: Side | null;
  record: ScoreRecord | null;
}

export interface ScorerState {
  /** The server version the record builds on. */
  baseVersion: number;
  record: ScoreRecord | null;
  /** Bumped by every change to the record. */
  revision: number;
  /** The last revision the server confirmed. */
  savedRevision: number;
  /** The revision on its way to the server, else null. */
  sendingRevision: number | null;
  /** Failed saves in a row, which set the retry delay. */
  failures: number;
  /** Why the server refused a save for good, else null. */
  error: string | null;
  /** The stored match when a save found it changed elsewhere, else null. */
  conflict: MatchSnapshot | null;
  /** A point that would end the match, waiting for the umpire to confirm it. */
  finalEvent: MatchEvent | null;
  /** The server's status and winner, as of the last save or load. */
  status: MatchStatus;
  winner: Side | null;
}

export type ScorerAction =
  | { type: "start"; record: ScoreRecord }
  | { type: "score"; event: MatchEvent }
  | { type: "confirmFinal" }
  | { type: "undo" }
  | { type: "sendStarted"; revision: number }
  | { type: "saved"; revision: number; match: MatchSnapshot }
  | { type: "sendFailed"; revision: number }
  | { type: "rejected"; revision: number; message: string }
  | { type: "conflicted"; revision: number; match: MatchSnapshot }
  | { type: "retryNow" }
  | { type: "keepDevice" }
  | { type: "replaceWithServer"; match: MatchSnapshot };

export interface PendingSave {
  revision: number;
  baseVersion: number;
  record: ScoreRecord;
}

/** Wait before each save attempt, by failures so far. The first attempt goes at once. */
const RETRY_DELAYS_MS = [0, 1_000, 2_000, 5_000, 10_000] as const;

export function snapshotOf(match: Match): MatchSnapshot {
  const topWon =
    match.topSlot.kind === "entry" && match.topSlot.entryId === match.winnerEntryId;
  return {
    version: match.version,
    status: match.status,
    winner: match.winnerEntryId === null ? null : topWon ? "top" : "bottom",
    record: scoreRecordOf(match),
  };
}

/** The state when the page opens, from the server's match and what the device kept. */
export function initialScorerState(server: MatchSnapshot, device: DeviceScore | null): ScorerState {
  const common = {
    sendingRevision: null,
    failures: 0,
    error: null,
    finalEvent: null,
    winner: server.winner,
  };
  const loaded = reconcileScore(server.version, server.record, device);
  switch (loaded.kind) {
    case "server":
      return {
        ...common,
        baseVersion: server.version,
        record: server.record,
        revision: 0,
        savedRevision: 0,
        conflict: null,
        status: server.status,
      };
    case "device":
      return {
        ...common,
        baseVersion: loaded.device.baseVersion,
        record: loaded.device.record,
        revision: 1,
        savedRevision: 0,
        conflict: null,
        status: "in_progress",
      };
    case "conflict":
      return {
        ...common,
        baseVersion: loaded.device.baseVersion,
        record: loaded.device.record,
        revision: 1,
        savedRevision: 0,
        conflict: server,
        status: server.status,
      };
  }
}

function requireRecord(state: ScorerState): ScoreRecord {
  if (state.record === null) throw new Error("Start the match before scoring it.");
  return state.record;
}

function withRecord(state: ScorerState, record: ScoreRecord): ScorerState {
  return { ...state, record, revision: state.revision + 1, finalEvent: null };
}

export function scorerReducer(state: ScorerState, action: ScorerAction): ScorerState {
  switch (action.type) {
    case "start":
      if (state.record !== null) throw new Error("The match has already started.");
      return withRecord({ ...state, status: "in_progress" }, action.record);
    case "score": {
      const record = requireRecord(state);
      if (state.finalEvent !== null) throw new Error("Confirm or undo the final point first.");
      const events = [...record.events, action.event];
      const next = deriveState(events, standardFormat(record.decidingSet), record.firstServer);
      if (next.status === "completed") return { ...state, finalEvent: action.event };
      return withRecord(state, { ...record, events });
    }
    case "confirmFinal": {
      const record = requireRecord(state);
      if (state.finalEvent === null) throw new Error("There is no final point to confirm.");
      return withRecord(state, { ...record, events: [...record.events, state.finalEvent] });
    }
    case "undo": {
      if (state.finalEvent !== null) return { ...state, finalEvent: null };
      const record = requireRecord(state);
      if (record.events.length === 0) return state;
      return withRecord(state, { ...record, events: record.events.slice(0, -1) });
    }
    case "sendStarted":
      return { ...state, sendingRevision: action.revision };
    case "saved":
      if (action.revision !== state.sendingRevision) return state;
      return {
        ...state,
        baseVersion: action.match.version,
        savedRevision: action.revision,
        sendingRevision: null,
        failures: 0,
        status: action.match.status,
        winner: action.match.winner,
      };
    case "sendFailed":
      if (action.revision !== state.sendingRevision) return state;
      return { ...state, sendingRevision: null, failures: state.failures + 1 };
    case "rejected":
      if (action.revision !== state.sendingRevision) return state;
      return { ...state, sendingRevision: null, error: action.message };
    case "conflicted":
      if (action.revision !== state.sendingRevision) return state;
      return { ...state, sendingRevision: null, conflict: action.match };
    case "retryNow":
      return { ...state, failures: 0, error: null };
    case "keepDevice": {
      if (state.conflict === null) throw new Error("There is no conflict to resolve.");
      if (state.conflict.status === "completed") {
        throw new Error("The match was completed elsewhere, so the device score cannot replace it.");
      }
      return {
        ...state,
        baseVersion: state.conflict.version,
        conflict: null,
        revision: state.revision + 1,
      };
    }
    case "replaceWithServer": {
      const revision = state.revision + 1;
      return {
        ...state,
        baseVersion: action.match.version,
        record: action.match.record,
        revision,
        savedRevision: revision,
        sendingRevision: null,
        failures: 0,
        error: null,
        conflict: null,
        finalEvent: null,
        status: action.match.status,
        winner: action.match.winner,
      };
    }
  }
}

export function hasUnsavedChanges(state: ScorerState): boolean {
  return state.revision !== state.savedRevision;
}

/** The save to send next, or null while one is in flight, blocked, or not needed. */
export function pendingSave(state: ScorerState): PendingSave | null {
  if (
    !hasUnsavedChanges(state) ||
    state.record === null ||
    state.sendingRevision !== null ||
    state.conflict !== null ||
    state.error !== null
  ) {
    return null;
  }
  return { revision: state.revision, baseVersion: state.baseVersion, record: state.record };
}

export function retryDelayMs(failures: number): number {
  return RETRY_DELAYS_MS[Math.min(failures, RETRY_DELAYS_MS.length - 1)];
}

/** What to keep on the device, or null before the match starts. */
export function deviceScoreOf(state: ScorerState): DeviceScore | null {
  if (state.record === null) return null;
  return {
    baseVersion: state.baseVersion,
    record: state.record,
    unsaved: hasUnsavedChanges(state),
  };
}
