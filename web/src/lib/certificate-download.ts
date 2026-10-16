import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import type { Database } from "@/db/draws";
import { listScoringMatches } from "@/db/matches";
import { getPartnerInvitation, listTeamEntryIds } from "@/db/partners";
import { profiles, tournaments, type Category } from "@/db/schema";
import { loadCertificateArtwork } from "@/lib/certificate-artwork";
import { UnprintableTextError, certificatePdf } from "@/lib/certificate-pdf";
import {
  certificateFileName,
  certificateLabel,
  certificateText,
  earnedCertificates,
  type CertificateKind,
} from "@/lib/certificates";
import { formatTournamentDates } from "@/lib/format";
import { formatPlayerId } from "@/lib/player-card";

const PRIVATE_NO_STORE = "private, no-store";

export interface RenderedCertificate {
  pdf: Uint8Array;
  fileName: string;
  /** e.g. "Open singles · Winner's certificate". */
  label: string;
  category: Category;
  kind: CertificateKind;
  playerName: string;
  tournamentName: string;
}

function textResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": PRIVATE_NO_STORE },
  });
}

/**
 * The player's certificate as a PDF, or null when they have not earned it. Callers must
 * authorize access to the player first. Throws UnprintableTextError for names the
 * certificate fonts cannot print.
 */
export async function renderPlayerCertificate(
  database: Database,
  userId: string,
  entryId: string,
  kind: string,
): Promise<RenderedCertificate | null> {
  const invitation = getPartnerInvitation(database, entryId);
  if (!invitation) return null;
  const tournament = database.select().from(tournaments).where(eq(tournaments.id, invitation.entry.tournamentId)).get();
  if (!tournament) return null;

  const certificate = earnedCertificates(
    listScoringMatches(database, tournament.id),
    new Set(listTeamEntryIds(database, userId)),
  ).find((item) => item.entryId === entryId && item.kind === kind);
  const profile = database.select().from(profiles).where(eq(profiles.userId, userId)).get();
  if (!certificate || !profile) return null;

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

  return {
    pdf: await certificatePdf(text, await loadCertificateArtwork()),
    fileName: certificateFileName(tournament.name, certificate.category, certificate.kind),
    label: certificateLabel(certificate),
    category: certificate.category,
    kind: certificate.kind,
    playerName: profile.fullName,
    tournamentName: tournament.name,
  };
}

/** Shared download response; callers must authorize access to the supplied player first. */
export async function downloadPlayerCertificate(userId: string, entryId: string, kind: string): Promise<Response> {
  try {
    const rendered = await renderPlayerCertificate(getDb(), userId, entryId, kind);
    if (!rendered) return textResponse("You have no such certificate.", 404);
    return new Response(Buffer.from(rendered.pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${rendered.fileName}"`,
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
