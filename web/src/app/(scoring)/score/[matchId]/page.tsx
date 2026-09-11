import { notFound } from "next/navigation";

import { resetMatchAction, retireMatchAction } from "../actions";
import { Scorer } from "./scorer";
import { requireScorer } from "@/auth/require";
import { getDb } from "@/db/client";
import { getScoringMatch } from "@/db/matches";
import { CATEGORY_LABELS } from "@/lib/entries";
import { sideLabel } from "@/lib/scoring-display";
import { snapshotOf } from "@/lib/score-sync";

export const dynamic = "force-dynamic";

export default async function ScoreMatchPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  await requireScorer();
  const row = getScoringMatch(getDb(), (await params).matchId);
  if (!row) notFound();
  const { match } = row;

  return (
    <Scorer
      matchId={match.id}
      matchNumber={match.matchNumber}
      heading={`${CATEGORY_LABELS[row.category]} · ${match.roundName}`}
      court={match.court}
      sides={{
        top: sideLabel(row.top, match.topSlot),
        bottom: sideLabel(row.bottom, match.bottomSlot),
      }}
      ready={match.topSlot.kind === "entry" && match.bottomSlot.kind === "entry"}
      initial={snapshotOf(match)}
      retireAction={retireMatchAction}
      resetAction={resetMatchAction}
    />
  );
}
