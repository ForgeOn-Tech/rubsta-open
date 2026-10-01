import { auth } from "@/auth/auth";
import { getDb } from "@/db/client";
import { fanFeed } from "@/db/fan-feed";
import { getCurrentTournament } from "@/db/queries";
import { VIEWER_PARAM } from "@/lib/fan-feed";
import { VIEWER_ID_PATTERN, fanPresence } from "@/lib/fan-presence";
import { MAX_COURT } from "@/lib/score-record";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function courtNumberOf(value: string): number | null {
  const courtNumber = Number(value);
  if (!Number.isInteger(courtNumber) || courtNumber < 1 || courtNumber > MAX_COURT) return null;
  return courtNumber;
}

/**
 * One court's score, chat, votes, reactions and watching count, for the Fan
 * Zone page to poll. Open to everyone, so it carries display names only: no
 * email addresses and no account ids.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ courtNumber: string }> },
): Promise<Response> {
  const courtNumber = courtNumberOf((await params).courtNumber);
  if (courtNumber === null) {
    return Response.json({ error: "Unknown court." }, { status: 404, headers: NO_STORE });
  }

  const session = await auth();
  const viewerId = new URL(request.url).searchParams.get(VIEWER_PARAM) ?? "";
  const now = Date.now();
  const watching = VIEWER_ID_PATTERN.test(viewerId)
    ? fanPresence().seen(viewerId, courtNumber, now)
    : fanPresence().watching(courtNumber, now);

  const tournament = getCurrentTournament();
  const feed = fanFeed(getDb(), {
    tournamentId: tournament?.id ?? null,
    courtNumber,
    userId: session?.user?.id ?? null,
    watching,
  });

  return Response.json(feed, { headers: NO_STORE });
}
