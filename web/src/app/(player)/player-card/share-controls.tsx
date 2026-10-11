"use client";
import { useActionState, useState } from "react";
import { setCardSharing } from "./actions";
export function ShareControls({ token }: { token: string | null }) {
  const [state, action, pending] = useActionState(setCardSharing, { token, error: null });
  const [notice, setNotice] = useState<{ token: string | null; message: string } | null>(null);
  const path = state.token ? `/players/${state.token}` : null;
  async function share(copy: boolean) {
    if (!path) return;
    const url = new URL(path, window.location.origin).href;
    try {
      if (!copy && navigator.share) { await navigator.share({ title: "My Rubsta Open Player Card", url }); setNotice({ token: state.token, message: "Share menu opened." }); }
      else { await navigator.clipboard.writeText(url); setNotice({ token: state.token, message: "Link copied." }); }
    } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setNotice({ token: state.token, message: "Could not share automatically. Open the public card and copy its address." }); }
  }
  return <details className="mb-8 border border-club-line p-5"><summary className="cursor-pointer text-sm font-medium"><span>Sharing options</span> · {path ? "Link active" : "Private"}</summary><section aria-label="Card sharing" className="mt-5">
    <h2 className="font-serif text-2xl">{path ? "Your share link is active" : "Your card is private"}</h2>
    <p className="mt-2 text-sm text-club-muted">Enabling sharing lets anyone with the link see your name, club, sporting history, results and earned certificates. Your phone, email and date of birth stay private.</p>
    <form action={action} className="mt-4"><input type="hidden" name="intent" value={path ? "disable" : "enable"} /><button disabled={pending} className="pill pill-outline">{pending ? "Saving…" : path ? "Turn off sharing" : "Enable share link"}</button></form>
    {path && <div className="mt-4 flex flex-wrap gap-3"><a href={path} className="pill pill-outline">Open public card</a><button type="button" onClick={() => share(false)} className="pill pill-primary">Share card link</button><button type="button" onClick={() => share(true)} className="pill pill-outline">Copy link</button></div>}
    <p className="mt-3 text-xs text-club-muted">Turning sharing off disables the link and certificate downloads. Downloads already saved by someone cannot be recalled.</p>
    {state.error && <p role="alert" className="mt-3">{state.error}</p>}
    {path && notice?.token === state.token && <p role="status" className="mt-3">{notice.message}</p>}
  </section></details>;
}
