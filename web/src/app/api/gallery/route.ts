import { getDb } from "@/db/client";
import { listGallery } from "@/db/gallery";
import { getCurrentTournament } from "@/db/queries";
export const dynamic = "force-dynamic";
export function GET() {
  const tournament = getCurrentTournament();
  return Response.json({ photos: tournament ? listGallery(getDb(), { tournamentId: tournament.id, limit: 12 }) : [] }, { headers: { "Cache-Control": "no-store" } });
}
