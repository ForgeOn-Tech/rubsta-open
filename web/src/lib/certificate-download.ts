import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { listScoringMatches } from "@/db/matches";
import { getPartnerInvitation, listTeamEntryIds } from "@/db/partners";
import { profiles, tournaments } from "@/db/schema";
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

/** Shared rendering; callers must authorize access to the supplied player first. */
export async function downloadPlayerCertificate(userId: string, entryId: string, kind: string): Promise<Response> {
  const database = getDb();
  const invitation = getPartnerInvitation(database, entryId);
  const tournament = invitation ? database.select().from(tournaments).where(eq(tournaments.id, invitation.entry.tournamentId)).get() : null;
  if (!tournament) return textResponse("No tournament has been set up.", 404);

  const certificate = earnedCertificates(
    listScoringMatches(database, tournament.id),
    new Set(listTeamEntryIds(database, userId)),
  ).find((item) => item.entryId === entryId && item.kind === kind);
  const profile = database.select().from(profiles).where(eq(profiles.userId, userId)).get();
  if (!certificate || !profile || !invitation) {
    return textResponse("You have no such certificate.", 404);
  }

  const { entry } = invitation;
  const inviterName = database.select({ name: profiles.fullName }).from(profiles).where(eq(profiles.userId, entry.userId)).get()?.name ?? "Partner";
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
