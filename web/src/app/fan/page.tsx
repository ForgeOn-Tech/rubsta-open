import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { getCurrentTournament } from "@/db/queries";
import { getFanDraws } from "@/db/fan";
import { FanHub } from "./fan-hub";
import { DEMO_DRAWS } from "./demo";
import "./fan.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Fan club · Rubsta Open",
  description: "Explore the published draws and follow your favourites at Rubsta Open.",
};

export default async function FanPage({ searchParams }: {
  searchParams: Promise<{ demo?: string }>;
}) {
  if ((await searchParams).demo === "1") {
    return <FanHub key="demo" demo tournamentId="rubsta-demo" name="Rubsta Open 2026"
      venue="Vazirani National Sports Academy" startsOn="2026-10-24" endsOn="2026-10-25"
      draws={DEMO_DRAWS} />;
  }
  const tournament = getCurrentTournament();
  return <FanHub
    key="tournament"
    tournamentId={tournament?.id ?? "rubsta-open"}
    name={tournament?.name ?? "Rubsta Open"}
    venue={tournament?.scheduleConfirmed ? tournament.venue : null}
    startsOn={tournament?.scheduleConfirmed ? tournament.startsOn : null}
    endsOn={tournament?.scheduleConfirmed ? tournament.endsOn : null}
    draws={tournament ? getFanDraws(getDb(), tournament.id) : []}
  />;
}
