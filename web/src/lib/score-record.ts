import { SIDES, type DecidingSet, type MatchEvent, type Side } from "@/lib/match";

/**
 * An umpire's score for one match: how it started and every event since.
 * The scoring page keeps it on the device and saves it whole, so a dropped
 * connection never loses a point.
 */
export interface ScoreRecord {
  firstServer: Side;
  decidingSet: DecidingSet;
  court: number | null;
  /** Epoch milliseconds when the umpire started the match. */
  startedAt: number;
  events: MatchEvent[];
}

/** What the device keeps for a match between saves. */
export interface DeviceScore {
  /** The server version this record builds on. */
  baseVersion: number;
  record: ScoreRecord;
  /** The record has changes the server has not confirmed. */
  unsaved: boolean;
}

/** The stored match columns a score record comes from. */
export interface StoredScoreColumns {
  firstServer: Side | null;
  decidingSet: DecidingSet;
  court: number | null;
  startedAt: number | null;
  events: MatchEvent[];
}

export type LoadedScore =
  | { kind: "server" }
  | { kind: "device"; device: DeviceScore }
  | { kind: "conflict"; device: DeviceScore };

export const DECIDING_SETS: readonly DecidingSet[] = ["set", "matchTiebreak"];
const SIDELESS_EVENT_TYPES = ["fault", "doubleFault", "let"] as const;

export const MAX_COURT = 99;
/** A sanity cap far above the event count of any real match. */
export const MAX_EVENTS = 5000;

function fieldsOf(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${what} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function parseSide(value: unknown, what: string): Side {
  const side = SIDES.find((candidate) => candidate === value);
  if (side === undefined) {
    throw new Error(`${what} must be "top" or "bottom", not ${JSON.stringify(value)}.`);
  }
  return side;
}

function parseEvent(value: unknown, index: number): MatchEvent {
  const fields = fieldsOf(value, `Event ${index}`);
  if (fields.type === "point") {
    return { type: "point", side: parseSide(fields.side, `Event ${index} side`) };
  }
  const type = SIDELESS_EVENT_TYPES.find((candidate) => candidate === fields.type);
  if (type === undefined) {
    throw new Error(`Event ${index} has an unknown type ${JSON.stringify(fields.type)}.`);
  }
  return { type };
}

function parseCourt(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_COURT) {
    return value;
  }
  throw new Error(`Court must be empty or a whole number from 1 to ${MAX_COURT}.`);
}

function parseTimestamp(value: unknown, what: string): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  throw new Error(`${what} must be a positive timestamp.`);
}

/** Checks untrusted input, such as a Server Action argument, as a score record. */
export function parseScoreRecord(value: unknown): ScoreRecord {
  const fields = fieldsOf(value, "The score record");
  const decidingSet = DECIDING_SETS.find((candidate) => candidate === fields.decidingSet);
  if (decidingSet === undefined) {
    throw new Error(`Unknown deciding set ${JSON.stringify(fields.decidingSet)}.`);
  }
  if (!Array.isArray(fields.events)) throw new Error("Events must be a list.");
  if (fields.events.length > MAX_EVENTS) {
    throw new Error(`A match cannot have more than ${MAX_EVENTS} events.`);
  }
  return {
    firstServer: parseSide(fields.firstServer, "The first server"),
    decidingSet,
    court: parseCourt(fields.court),
    startedAt: parseTimestamp(fields.startedAt, "The start time"),
    events: fields.events.map(parseEvent),
  };
}

/** Checks what localStorage returned as a device score. */
export function parseDeviceScore(value: unknown): DeviceScore {
  const fields = fieldsOf(value, "The device score");
  const baseVersion = fields.baseVersion;
  if (typeof baseVersion !== "number" || !Number.isInteger(baseVersion) || baseVersion < 0) {
    throw new Error("The device score's base version must be a whole number.");
  }
  if (typeof fields.unsaved !== "boolean") {
    throw new Error("The device score must say whether it is unsaved.");
  }
  return { baseVersion, record: parseScoreRecord(fields.record), unsaved: fields.unsaved };
}

function sameEvent(a: MatchEvent, b: MatchEvent): boolean {
  if (a.type === "point" || b.type === "point") {
    return a.type === "point" && b.type === "point" && a.side === b.side;
  }
  return a.type === b.type;
}

/** True when two records share their start details and every event. Court is not compared. */
export function sameScore(a: ScoreRecord, b: ScoreRecord): boolean {
  return (
    a.firstServer === b.firstServer &&
    a.decidingSet === b.decidingSet &&
    a.startedAt === b.startedAt &&
    a.events.length === b.events.length &&
    a.events.every((event, index) => sameEvent(event, b.events[index]))
  );
}

/** The record a stored match holds, or null before an umpire starts it. */
export function scoreRecordOf(match: StoredScoreColumns): ScoreRecord | null {
  if (match.firstServer === null || match.startedAt === null) return null;
  return {
    firstServer: match.firstServer,
    decidingSet: match.decidingSet,
    court: match.court,
    startedAt: match.startedAt,
    events: match.events,
  };
}

/**
 * Picks the score to show when the scoring page opens. Unsaved device changes
 * win while the server is still at their base version. They are dropped when
 * the server already holds the same record, and conflict otherwise.
 */
export function reconcileScore(
  serverVersion: number,
  serverRecord: ScoreRecord | null,
  device: DeviceScore | null,
): LoadedScore {
  if (device === null || !device.unsaved) return { kind: "server" };
  if (device.baseVersion === serverVersion) return { kind: "device", device };
  if (serverRecord !== null && sameScore(serverRecord, device.record)) return { kind: "server" };
  return { kind: "conflict", device };
}
