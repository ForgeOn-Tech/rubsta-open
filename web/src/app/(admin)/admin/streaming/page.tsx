import Link from "next/link";
import { requireAdmin } from "@/auth/require";
import { getDb } from "@/db/client";
import { getCurrentTournament } from "@/db/queries";
import { listCourts } from "@/db/courts";
import { getBroadcast } from "@/db/broadcasts";
import { courtTitle } from "@/lib/schedule";
import { StreamForm } from "./stream-form";

export const dynamic = "force-dynamic";
export default async function StreamingPage() {
  await requireAdmin();
  const tournament = getCurrentTournament();
  const courts = tournament ? listCourts(getDb(), tournament.id) : [];
  return <div className="mx-auto max-w-4xl space-y-7 px-5 py-7 sm:px-8">
    <header><p className="text-xs uppercase tracking-widest text-muted">{tournament?.name ?? "Rubsta Open"}</p><h1 className="mt-3 font-serif text-4xl">Live streaming</h1><p className="mt-3 max-w-xl text-sm text-muted">Connect a YouTube broadcast to each court. Fans watch it alongside the tournament’s live scores and chat.</p></header>
    <details className="border border-line p-5"><summary className="cursor-pointer font-medium">First broadcast? Start here</summary><ol className="mt-4 list-decimal space-y-3 pl-5 text-sm"><li>Enable live streaming on Rubsta’s YouTube channel in advance. First-time activation can take up to 24 hours.</li><li>Send the camera feed to YouTube using a phone app or streaming software. Use a stable connection and continuous power.</li><li>Paste the public video link below, choose Starting soon and save. Check the preview plays.</li><li>Once the camera is broadcasting, choose Live and save. After the broadcast, choose Ended and optionally add its replay link.</li></ol><a className="mt-4 inline-block text-sm underline" href="https://support.google.com/youtube/answer/2907883" target="_blank" rel="noreferrer">YouTube setup guide ↗</a></details>
    {!courts.length && <p>No courts yet. <Link className="underline" href="/admin/settings">Add courts in Settings</Link> to set up a stream.</p>}
    {courts.map(court => <section key={court.id} aria-label={courtTitle(court.number)} className="border border-line bg-surface-1 p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-serif text-3xl">{courtTitle(court.number)}{court.name ? ` · ${court.name}` : ""}</h2><Link href={`/live/${court.number}`} target="_blank" className="py-2 text-sm underline">Open viewer page ↗</Link></div><StreamForm courtNumber={court.number} initial={getBroadcast(getDb(), court.tournamentId, court.number)!} /></section>)}
  </div>;
}
