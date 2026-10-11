import { getDb } from "@/db/client";
import { getPlayerCard, sharedCardOwner } from "@/db/player-cards";
import { downloadPlayerCertificate } from "@/lib/certificate-download";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ token: string; entryId: string; kind: string }> }) {
  const { token, entryId, kind } = await params;
  const userId = sharedCardOwner(getDb(), token);
  const card = userId ? getPlayerCard(getDb(), userId) : null;
  if (!userId || !card?.tournaments.some(t => t.certificates.some(c => c.entryId === entryId && c.kind === kind))) return new Response("Certificate not available.", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  return downloadPlayerCertificate(userId, entryId, kind);
}
