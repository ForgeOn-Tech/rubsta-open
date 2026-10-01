import { parseMatchSnapshot, type MatchSnapshot, type PendingSave } from "@/lib/score-sync";

export type SaveOutcome =
  | { kind: "saved"; match: MatchSnapshot }
  | { kind: "conflict"; match: MatchSnapshot }
  | { kind: "rejected"; message: string }
  | { kind: "failed" };

/** A save with no answer by then counts as failed and is retried. */
const SAVE_TIMEOUT_MS = 10_000;
const FIRST_SERVER_ERROR_STATUS = 500;

function errorMessageOf(body: unknown, status: number): string {
  if (typeof body === "object" && body !== null) {
    const { error } = body as Record<string, unknown>;
    if (typeof error === "string") return error;
  }
  return `The server refused the score (HTTP ${status}).`;
}

function outcomeOf(body: unknown): SaveOutcome {
  if (typeof body !== "object" || body === null) {
    throw new Error("The save response is not an object.");
  }
  const { kind, match } = body as Record<string, unknown>;
  if (kind !== "saved" && kind !== "conflict") {
    throw new Error(`Unknown save result ${JSON.stringify(kind)}.`);
  }
  return { kind, match: parseMatchSnapshot(match) };
}

/**
 * Sends one save to /api/matches/<id>/score. It never throws: network
 * failures, timeouts, 5xx answers and unreadable responses (such as a Wi-Fi
 * sign-in page) come back as "failed", which the scoring page retries.
 */
export async function saveScore(matchId: string, save: PendingSave): Promise<SaveOutcome> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), SAVE_TIMEOUT_MS);
  try {
    const response = await fetch(`/api/matches/${encodeURIComponent(matchId)}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseVersion: save.baseVersion, record: save.record }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (response.status >= FIRST_SERVER_ERROR_STATUS) {
      console.warn(`Saving match ${matchId} got HTTP ${response.status}; it will retry.`);
      return { kind: "failed" };
    }
    const body: unknown = await response.json();
    if (!response.ok) return { kind: "rejected", message: errorMessageOf(body, response.status) };
    return outcomeOf(body);
  } catch (error) {
    console.warn(`Saving match ${matchId} failed; it will retry.`, error);
    return { kind: "failed" };
  } finally {
    window.clearTimeout(timeout);
  }
}
