"use client";
import { useActionState, useState } from "react";
import { BROADCAST_LABELS, BROADCAST_STATUSES, type BroadcastSettings, type BroadcastStatus } from "@/lib/broadcast";
import { streamEmbedUrl } from "@/lib/stream";
import { INITIAL_ACTION_STATE } from "@/lib/form-state";
import { saveStream } from "./actions";

export function StreamForm({ courtNumber, initial }: { courtNumber: number; initial: BroadcastSettings }) {
  const [state, action, pending] = useActionState(saveStream, INITIAL_ACTION_STATE);
  const [status, setStatus] = useState<BroadcastStatus>(initial.status);
  const [streamUrl, setStreamUrl] = useState(initial.streamUrl ?? "");
  const [replayUrl, setReplayUrl] = useState(initial.replayUrl ?? "");
  const [dirty, setDirty] = useState(false);
  const preview = streamEmbedUrl(status === "ended" ? replayUrl : streamUrl);
  return <form action={action} onSubmit={() => setDirty(false)} className="mt-5 space-y-5" onChange={() => setDirty(true)}>
    <input type="hidden" name="courtNumber" value={courtNumber} />
    <fieldset disabled={pending} className="space-y-5 disabled:opacity-60">
      <label className="block text-sm">YouTube stream link<input name="streamUrl" type="url" maxLength={2048} value={streamUrl} onChange={e => { setStreamUrl(e.target.value); setReplayUrl(""); }} placeholder="https://www.youtube.com/watch?v=…" className="field mt-2 w-full" /></label>
      <p className="text-xs text-muted">Use the public watch link from YouTube. Your stream key stays in your camera or streaming software.</p>
      <label className="block text-sm">Broadcast status<select name="status" className="field mt-2 w-full" value={status} onChange={e => setStatus(e.target.value as BroadcastStatus)}>{BROADCAST_STATUSES.map(value => <option key={value} value={value}>{BROADCAST_LABELS[value]}</option>)}</select></label>
      <p className="text-xs text-muted">This changes the label for fans. It does not start or stop your camera or YouTube broadcast.</p>
      {status === "ended" ? <label className="block text-sm">Replay link (optional)<input name="replayUrl" type="url" maxLength={2048} value={replayUrl} onChange={e => setReplayUrl(e.target.value)} className="field mt-2 w-full" /><span className="mt-2 block text-xs text-muted">Add the recording’s YouTube link once it can be watched. Leave blank to show “Broadcast ended”.</span></label> : <input type="hidden" name="replayUrl" value={replayUrl} />}
      <button className="btn btn-primary min-h-11" type="submit">{pending ? "Saving…" : "Save broadcast"}</button>
      <details className="border border-line p-4"><summary className="min-h-7 cursor-pointer text-sm">Preview video</summary>
        <div className="mt-4">{preview ? <iframe key={preview} src={preview} title={`Court ${courtNumber} preview`} allow="encrypted-media; picture-in-picture" allowFullScreen className="aspect-video w-full border border-line" /> : <p className="text-sm text-muted">Add a valid YouTube link to preview it.</p>}</div>
        <p className="mt-3 text-xs text-muted">Check that the video plays here before marking Live. If YouTube blocks playback on other sites, enable embedding in YouTube Studio.</p>
      </details>
    </fieldset>
    {state.error && !dirty && !pending && <p role="alert" className="text-sm text-bad">{state.error}</p>}
    {state.savedAt && !dirty && !pending && <p role="status" className="text-sm">Broadcast saved. Open court pages update within a few seconds.</p>}
  </form>;
}
