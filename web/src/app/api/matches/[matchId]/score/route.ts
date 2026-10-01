import { auth } from "@/auth/auth";
import { canScoreMatches } from "@/auth/require";
import { getDb } from "@/db/client";
import { MatchNotFoundError, ScoreRejectedError, saveMatchScore } from "@/db/matches";
import { parseScoreRecord, type ScoreRecord } from "@/lib/score-record";
import { snapshotOf } from "@/lib/score-sync";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

interface SaveRequest {
  baseVersion: number;
  record: ScoreRecord;
}

function errorResponse(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

function parseSaveRequest(body: unknown): SaveRequest {
  if (typeof body !== "object" || body === null) {
    throw new Error("The request body must be an object.");
  }
  const { baseVersion, record } = body as Record<string, unknown>;
  if (typeof baseVersion !== "number" || !Number.isInteger(baseVersion) || baseVersion < 0) {
    throw new Error("baseVersion must be a whole number.");
  }
  return { baseVersion, record: parseScoreRecord(record) };
}

/**
 * Saves a scoring device's whole score record: POST { baseVersion, record }.
 * Answers { kind: "saved" | "conflict", match }, or { error } with 400, 401,
 * 403, 404, 415 or 422. The scoring page retries only network failures and
 * 5xx answers, so a failure that is not the device's fault throws.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(401, "Sign in again to save scores.");
  if (!canScoreMatches(session.user.email ?? "")) {
    return errorResponse(403, "This account is not allowed to score matches.");
  }
  // JSON only, so a cross-site form post cannot reach the save.
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return errorResponse(415, "Send the score as application/json.");
  }

  let input: SaveRequest;
  try {
    input = parseSaveRequest(await request.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(400, `The score could not be read: ${message}`);
  }

  const { matchId } = await params;
  try {
    const result = saveMatchScore(getDb(), matchId, input.baseVersion, input.record);
    return Response.json(
      { kind: result.kind, match: snapshotOf(result.match) },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof MatchNotFoundError) return errorResponse(404, error.message);
    if (error instanceof ScoreRejectedError) return errorResponse(422, error.message);
    throw error;
  }
}
