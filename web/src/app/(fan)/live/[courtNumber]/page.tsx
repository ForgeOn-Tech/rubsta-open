import Link from "next/link";
import { notFound } from "next/navigation";

import { predictAction, reactAction } from "./actions";
import { CourtLive } from "./court-live";
import { auth } from "@/auth/auth";
import { getDb } from "@/db/client";
import { listCourts } from "@/db/courts";
import { fanFeed } from "@/db/fan-feed";
import { getCurrentTournament } from "@/db/queries";
import { FAN_LIVE_PATH } from "@/lib/fan-chat";
import { MAX_COURT } from "@/lib/score-record";
import { courtDetail, courtTitle } from "@/lib/schedule";
import { streamEmbedUrl } from "@/lib/stream";

export const dynamic = "force-dynamic";

/** One court's Fan Zone: the stream, the live score, and who is watching. */
export default async function FanCourtPage({
  params,
}: {
  params: Promise<{ courtNumber: string }>;
}) {
  const courtNumber = Number((await params).courtNumber);
  if (!Number.isInteger(courtNumber) || courtNumber < 1 || courtNumber > MAX_COURT) notFound();

  const tournament = getCurrentTournament();
  const database = getDb();
  const court = tournament
    ? (listCourts(database, tournament.id).find((option) => option.number === courtNumber) ?? null)
    : null;
  if (court === null) notFound();

  const session = await auth();
  const feed = fanFeed(database, {
    tournamentId: tournament?.id ?? null,
    courtNumber,
    userId: session?.user?.id ?? null,
    watching: 0,
  });
  const detail = courtDetail(court);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={FAN_LIVE_PATH}
          className="text-[10px] font-medium uppercase tracking-[2px] text-club-lime"
        >
          <span aria-hidden="true">←</span> All courts
        </Link>
        <h1 className="mt-3 font-serif text-[46px] font-normal leading-none tracking-[-1px]">
          {courtTitle(courtNumber)}
        </h1>
        <p className="mt-2 text-[10px] font-medium uppercase tracking-[1.5px] text-club-mist/60">
          {tournament?.name ?? "Rubsta Open"}
          {detail === null ? "" : ` · ${detail}`}
        </p>
      </div>

      <CourtLive
        courtNumber={courtNumber}
        embedUrl={streamEmbedUrl(court.streamUrl)}
        initialFeed={feed}
        predictAction={predictAction}
        reactAction={reactAction}
      />
    </div>
  );
}
