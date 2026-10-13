import { BROADCAST_LABELS, type PublicBroadcast } from "@/lib/broadcast";

export function CourtStream({ broadcast, watching }: { broadcast: PublicBroadcast | null; watching: number }) {
  const status = broadcast?.status ?? "off";
  return <section aria-label="Court broadcast" className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className={`px-2 py-1 text-xs uppercase tracking-widest ${status === "live" ? "bg-club-lime text-club-forest" : "border border-club-mist/30 text-club-mist"}`}>{broadcast?.replay ? "Replay" : BROADCAST_LABELS[status]}</span>
      <span className="text-xs text-club-mist/60">{watching} on this page</span>
    </div>
    {broadcast?.embedUrl ? <iframe key={broadcast.embedUrl} src={broadcast.embedUrl} title={broadcast.replay ? "Court replay" : "Court stream"} allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="aspect-video w-full border border-club-mist/25" /> : <div className="flex aspect-video items-center justify-center border border-club-mist/25 p-5 text-center text-sm text-club-mist/70">{status === "ended" ? "Broadcast ended. A replay has not been added yet." : "No stream on this court"}</div>}
    {broadcast?.watchUrl && <a href={broadcast.watchUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm underline">{broadcast.replay ? "Watch replay on YouTube ↗" : "Video not playing? Watch on YouTube ↗"}</a>}
    {status !== "off" && <p className="text-xs text-club-mist/60">Broadcast status is set by the organisers. YouTube playback may be delayed.</p>}
  </section>;
}
