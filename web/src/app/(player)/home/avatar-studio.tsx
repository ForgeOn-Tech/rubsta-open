"use client";

import { useState } from "react";
import { AVATAR_DEFAULT_QUOTE, AVATAR_MAX_QUOTE, avatarPhotoError, avatarQuote } from "@/lib/avatar";

export function AvatarStudio({ name, enabled, initialVersion, accessError }: {
  name: string; enabled: boolean; initialVersion: number | null; accessError: string | null;
}) {
  const [version, setVersion] = useState(initialVersion);
  const [quote, setQuote] = useState(AVATAR_DEFAULT_QUOTE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [card, setCard] = useState<string | null>(null);
  const unavailable = accessError || (!enabled ? "Avatar generation is coming soon. Your registration is complete without it." : null);

  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const photo = data.get("photo");
    const invalid = photo instanceof File ? avatarPhotoError(photo.size, photo.type) : "Choose a photo.";
    if (invalid) { setError(invalid); return; }
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/avatar", { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Please try again later.");
      setVersion(Date.now()); setCard(null); form.reset();
      setNotice("Your avatar is ready. Add a quote and preview your Instagram card.");
    } catch (error) { setError(error instanceof Error ? error.message : "Generation failed. Try again later."); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!window.confirm("Delete your saved avatar? Downloaded copies won't be affected.")) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/avatar", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete your avatar. Please retry.");
      setVersion(null); setCard(null); setNotice("Your saved avatar was deleted.");
    } catch (error) { setError(error instanceof Error ? error.message : "Please retry."); }
    finally { setBusy(false); }
  }

  async function previewCard() {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/avatar?v=${version}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Avatar unavailable. Try refreshing the page.");
      const bitmap = await createImageBitmap(await response.blob());
      const canvas = document.createElement("canvas");
      canvas.width = 1080; canvas.height = 1350;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("This browser cannot make a card.");
      await document.fonts.ready;
      ctx.fillStyle = "#f4f1e8"; ctx.fillRect(0, 0, 1080, 1350);
      ctx.fillStyle = "#203c2c"; ctx.fillRect(0, 0, 1080, 160);
      ctx.fillStyle = "#f3f1df"; ctx.textAlign = "center";
      ctx.font = '64px "Cormorant Garamond", serif'; ctx.fillText("Rubsta Open", 540, 98);
      ctx.drawImage(bitmap, 150, 195, 780, 780); bitmap.close();
      ctx.fillStyle = "#203c2c";
      ctx.font = '54px "Cormorant Garamond", serif'; ctx.fillText(name, 540, 1038, 950);
      ctx.font = '28px Inter, sans-serif';
      const text = `“${avatarQuote(quote)}”`;
      const lines: string[] = []; let line = "";
      for (const letter of Array.from(text)) {
        if (ctx.measureText(line + letter).width > 880) { lines.push(line); line = letter; }
        else line += letter;
      }
      lines.push(line);
      lines.slice(0, 4).forEach((value, index) => ctx.fillText(value, 540, 1100 + index * 38));
      ctx.font = '18px Inter, sans-serif'; ctx.fillText("AI-ILLUSTRATED PLAYER AVATAR · RUBSTA OPEN", 540, 1310);
      setCard(canvas.toDataURL("image/png"));
    } catch (error) { setError(error instanceof Error ? error.message : "Could not make your card."); }
    finally { setBusy(false); }
  }

  return (
    <section id="avatar" aria-labelledby="avatar-heading" className="bg-club-paper p-6 sm:p-10">
      <p className="text-[10px] uppercase tracking-[2px]">Optional · Your court-side sticker</p>
      <h2 id="avatar-heading" className="mt-3 font-serif text-[36px] leading-tight">A little more you.</h2>
      <p className="mt-3 max-w-xl text-[13px] text-club-muted">Turn a portrait into a cute illustrated tennis avatar. Add your own words, then download a card for Instagram. Nothing is posted automatically.</p>
      {unavailable ? <p className="mt-4 text-[13px]" role="status">{unavailable}</p> : (
        <form onSubmit={generate} className="mt-6 flex max-w-xl flex-col gap-4">
          <label className="text-[13px]">Your photo (JPG, PNG or WebP, up to 5 MB)
            <input className="mt-2 block w-full text-[13px]" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required disabled={busy} />
          </label>
          <p className="text-[12px] text-club-muted">Use a clear photo of just yourself. We send it to OpenAI to create your avatar. Rubsta does not save the original photo; OpenAI processes it under its data policies. Up to three attempts per day.</p>
          <label className="flex items-start gap-3 text-[12px]">
            <input type="checkbox" name="consent" value="yes" required disabled={busy} className="mt-1" />
            I am 18 or older, this is my photo, and I agree to it being processed by OpenAI to create my avatar. This does not give Rubsta permission to post it.
          </label>
          <button className="pill pill-primary self-start" type="submit" disabled={busy}>{busy ? "Working…" : version ? "Generate another avatar" : "Generate my tennis avatar"}</button>
        </form>
      )}
      {busy ? <p role="status" className="mt-4 text-[13px]">Please wait. Avatar generation can take a few minutes; keep this page open.</p> : null}
      {error ? <p role="alert" className="mt-4 text-[13px] text-bad">{error}</p> : null}
      {notice ? <p role="status" className="mt-4 text-[13px]">{notice}</p> : null}
      {version ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {/* Private, cookie-authenticated image: do not proxy through the public image optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={card ?? `/api/avatar?v=${version}`} alt={card ? "Your Instagram card preview" : "Your illustrated tennis avatar"} className="w-full max-w-sm" />
          <div className="flex flex-col items-start gap-4">
            <label className="w-full text-[13px]">Your quote
              <textarea className="field mt-2 w-full" maxLength={AVATAR_MAX_QUOTE} value={quote} onChange={event => { setQuote(event.target.value); setCard(null); }} disabled={busy} />
            </label>
            <button className="pill pill-primary" onClick={() => void previewCard()} disabled={busy}>Preview Instagram card</button>
            {card ? <a className="pill pill-outline" href={card} download="rubsta-open-avatar.png">Download Instagram card</a> : null}
            <p className="text-[12px] text-club-muted">1080 × 1350 PNG. Your contact details and date of birth are never included. Share only when you&apos;re happy with the preview.</p>
            <button className="text-[12px] underline" onClick={() => void remove()} disabled={busy}>Delete saved avatar</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
