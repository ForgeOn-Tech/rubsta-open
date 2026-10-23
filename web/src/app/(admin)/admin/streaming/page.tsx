import Link from "next/link";
import { requireAdmin } from "@/auth/require";
import { getDb } from "@/db/client";
import { getCurrentTournament } from "@/db/queries";
import { listCourts } from "@/db/courts";
import { getBroadcast } from "@/db/broadcasts";
import { listScoringMatches, type ScoringMatchRow } from "@/db/matches";
import { listPublishedDays } from "@/db/schedule";
import { CATEGORY_LABELS } from "@/db/schema";
import { courtViews, type CourtView } from "@/lib/fan-live";
import { courtTitle, publishedPlaces, type PublishedPlace } from "@/lib/schedule";
import { sideLabel } from "@/lib/scoring-display";
import { StreamForm } from "./stream-form";

export const dynamic = "force-dynamic";

/** e.g. "Open singles · Group A · M2 — Caheer Warik v Vihaan Jain". */
function matchLine(row: ScoringMatchRow): string {
  const top = sideLabel(row.top, row.match.topSlot).name;
  const bottom = sideLabel(row.bottom, row.match.bottomSlot).name;
  return `${CATEGORY_LABELS[row.category]} · ${row.match.roundName} · M${row.match.matchNumber} — ${top} v ${bottom}`;
}

/** What the camera on a court is showing now, from the umpire who started it, and what follows. */
function CourtNow({ view }: { view: CourtView | undefined }) {
  return (
    <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-[8rem_1fr]">
      <dt className="text-muted">On court now</dt>
      <dd className="font-medium">{view?.live ? matchLine(view.live) : "No match in play"}</dd>
      <dt className="text-muted">Up next</dt>
      <dd>{view?.next ? matchLine(view.next) : "Nothing else published for this court"}</dd>
    </dl>
  );
}

export default async function StreamingPage() {
  await requireAdmin();
  const tournament = getCurrentTournament();
  const database = getDb();
  const courts = tournament ? listCourts(database, tournament.id) : [];
  const rows = tournament ? listScoringMatches(database, tournament.id) : [];
  const places = tournament
    ? publishedPlaces(listPublishedDays(database, tournament.id), new Map(rows.map((row) => [row.match.id, row.match.matchNumber])))
    : new Map<string, PublishedPlace>();
  const views = courtViews(courts, rows, places);
  return <div className="mx-auto max-w-4xl space-y-7 px-5 py-7 sm:px-8">
    <header><p className="text-xs uppercase tracking-widest text-muted">{tournament?.name ?? "Rubsta Open"}</p><h1 className="mt-3 font-serif text-4xl">Live streaming</h1><p className="mt-3 max-w-xl text-sm text-muted">Connect a YouTube broadcast to each court. Fans watch it alongside the tournament’s live scores and chat.</p></header>
    <details className="border border-line p-5"><summary className="cursor-pointer font-medium">First broadcast? Start here</summary><ol className="mt-4 list-decimal space-y-3 pl-5 text-sm"><li>Enable live streaming on Rubsta’s YouTube channel in advance. First-time activation can take up to 24 hours.</li><li>Send the camera feed to YouTube using a phone app or streaming software. Use a stable connection and continuous power.</li><li>Paste the public video link below, choose Starting soon and save. Check the preview plays.</li><li>Once the camera is broadcasting, choose Live and save. After the broadcast, choose Ended and optionally add its replay link.</li></ol><a className="mt-4 inline-block text-sm underline" href="https://support.google.com/youtube/answer/2907883" target="_blank" rel="noreferrer">YouTube setup guide ↗</a></details>
    {!courts.length && <p>No courts yet. <Link className="underline" href="/admin/settings">Add courts in Settings</Link> to set up a stream.</p>}
    {courts.map(court => <section key={court.id} aria-label={courtTitle(court.number)} className="border border-line bg-surface-1 p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-serif text-3xl">{courtTitle(court.number)}{court.name ? ` · ${court.name}` : ""}</h2><Link href={`/live/${court.number}`} target="_blank" className="py-2 text-sm underline">Open viewer page ↗</Link></div><CourtNow view={views.find((view) => view.court.number === court.number)} /><StreamForm courtNumber={court.number} initial={getBroadcast(database, court.tournamentId, court.number)!} /></section>)}
  </div>;
}
