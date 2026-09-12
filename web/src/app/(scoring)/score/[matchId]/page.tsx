import { notFound } from "next/navigation";

import { resetMatchAction, retireMatchAction } from "../actions";
import { Scorer } from "./scorer";
import { requireScorer } from "@/auth/require";
import { getDb } from "@/db/client";
import { listCourts } from "@/db/courts";
import { getScoringMatch } from "@/db/matches";
import { getCurrentTournament } from "@/db/queries";
import { listPublishedDays } from "@/db/schedule";
import { CATEGORY_LABELS } from "@/lib/entries";
import { courtOptionLabel, publishedPlaces } from "@/lib/schedule";
import { sideLabel } from "@/lib/scoring-display";
import { snapshotOf } from "@/lib/score-sync";

export const dynamic = "force-dynamic";

export default async function ScoreMatchPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  await requireScorer();
  const database = getDb();
  const row = getScoringMatch(database, (await params).matchId);
  if (!row) notFound();
  const { match } = row;
  const tournament = getCurrentTournament();
  const courts = tournament ? listCourts(database, tournament.id) : [];
  const place = tournament
    ? (publishedPlaces(
        listPublishedDays(database, tournament.id),
        new Map([[match.id, match.matchNumber]]),
      ).get(match.id) ?? null)
    : null;

  return (
    <Scorer
      matchId={match.id}
      matchNumber={match.matchNumber}
      heading={`${CATEGORY_LABELS[row.category]} · ${match.roundName}`}
      court={match.court ?? place?.courtNumber ?? null}
      courts={courts.map((court) => ({ number: court.number, label: courtOptionLabel(court) }))}
      sides={{
        top: sideLabel(row.top, match.topSlot),
        bottom: sideLabel(row.bottom, match.bottomSlot),
      }}
      ready={match.topSlot.kind === "entry" && match.bottomSlot.kind === "entry"}
      initial={snapshotOf(match)}
      completedAt={match.completedAt}
      retireAction={retireMatchAction}
      resetAction={resetMatchAction}
    />
  );
}
