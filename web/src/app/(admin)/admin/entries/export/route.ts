import { requireAdmin } from "@/auth/require";
import { getCurrentTournament, listTournamentEntries } from "@/db/queries";
import { entryCsvRows, filterEntries, parseCategoryFilter } from "@/lib/admin-entries";
import { fileSlug, toCsv } from "@/lib/csv";
import { parseStatusFilter } from "@/lib/entries";

export const dynamic = "force-dynamic";

// Lets Excel detect UTF-8 (names and the rupee sign).
const UTF8_BOM = "﻿";

/** CSV of the entries table, honouring the same ?status= and ?category= filters. */
export async function GET(request: Request): Promise<Response> {
  await requireAdmin();

  const tournament = getCurrentTournament();
  if (!tournament) {
    return new Response("No tournament has been set up.", { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const rows = filterEntries(listTournamentEntries(tournament.id), {
    status: parseStatusFilter(searchParams.get("status") ?? undefined),
    category: parseCategoryFilter(searchParams.get("category") ?? undefined),
  });

  return new Response(UTF8_BOM + toCsv(entryCsvRows(rows)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileSlug(tournament.name)}-entries.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
