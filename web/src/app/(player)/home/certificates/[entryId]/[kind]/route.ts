import { eq } from "drizzle-orm";

import { auth } from "@/auth/auth";
import { getDb } from "@/db/client";
import { listScoringMatches } from "@/db/matches";
import { getPartnerInvitation, listTeamEntryIds } from "@/db/partners";
import { getCurrentTournament } from "@/db/queries";
import { profiles } from "@/db/schema";
import { UnprintableTextError, certificatePdf } from "@/lib/certificate-pdf";
import { certificateFileName, certificateText, earnedCertificates } from "@/lib/certificates";
import { formatTournamentDates } from "@/lib/format";
import { formatPlayerId } from "@/lib/player-card";

const PRIVATE_NO_STORE = "private, no-store";

function textResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": PRIVATE_NO_STORE },
  });
}

/** One of the signed-in player's certificates as a PDF download. Nobody else's certificates are reachable. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entryId: string; kind: string }> },
): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return textResponse("Sign in to download your certificates.", 401);

  const { entryId, kind } = await params;
  const tournament = getCurrentTournament();
  if (!tournament) return textResponse("No tournament has been set up.", 404);

  const database = getDb();
  const certificate = earnedCertificates(
    listScoringMatches(database, tournament.id),
    new Set(listTeamEntryIds(database, userId)),
  ).find((item) => item.entryId === entryId && item.kind === kind);
  const profile = database.select().from(profiles).where(eq(profiles.userId, userId)).get();
  const invitation = getPartnerInvitation(database, entryId);
  if (!certificate || !profile || !invitation) {
    return textResponse("You have no such certificate.", 404);
  }

  const { entry, inviterName } = invitation;
  const text = certificateText({
    kind: certificate.kind,
    playerName: profile.fullName,
    // Doubles: the player who made the entry sees their partner, and the partner sees the player.
    partnerName: entry.partnerStatus === null ? null : entry.userId === userId ? entry.partnerName : inviterName,
    category: certificate.category,
    tournamentName: tournament.name,
    dates: formatTournamentDates(tournament.startsOn, tournament.endsOn),
    venue: tournament.venue,
    playerId: profile.playerNumber === null ? null : formatPlayerId(profile.playerNumber, profile.createdAt),
  });

  try {
    const pdf = await certificatePdf(text);
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${certificateFileName(tournament.name, certificate.category, certificate.kind)}"`,
        "Cache-Control": PRIVATE_NO_STORE,
      },
    });
  } catch (error) {
    if (error instanceof UnprintableTextError) {
      return textResponse(
        "This certificate cannot be made yet. Its font cannot print some characters in the names on it.",
        422,
      );
    }
    throw error;
  }
}
