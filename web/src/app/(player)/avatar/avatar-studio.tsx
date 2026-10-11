"use client";

import { useEffect, useRef, useState } from "react";
import { AVATAR_DEFAULT_QUOTE, AVATAR_MAX_QUOTE, AVATAR_SHARE_CONSENT, avatarPhotoError, avatarQuote } from "@/lib/avatar";

import styles from "./avatar-studio.module.css";
import { suggestAvatarCaption } from "@/lib/avatar-captions";

type Step = "photo" | "caption" | "save";

export function AvatarStudio({ name, enabled, initialVersion, accessError, initialShared = false }: {
  name: string; enabled: boolean; initialVersion: number | null; accessError: string | null; initialShared?: boolean;
}) {
  const [step, setStep] = useState<Step>(initialVersion ? "caption" : "photo");
  const [creating, setCreating] = useState<"idle" | "loading" | "leaving">("idle");
  const photoInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  const [version, setVersion] = useState(initialVersion);
  const [quote, setQuote] = useState(AVATAR_DEFAULT_QUOTE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [card, setCard] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [shared, setShared] = useState(initialShared);
  const [shareConsent, setShareConsent] = useState(true);
  const [activity, setActivity] = useState("Working…");
  useEffect(() => {
    return () => { if (photoPreview) URL.revokeObjectURL(photoPreview); };
  }, [photoPreview]);
  useEffect(() => {
    // Read browser-only suggestion history after hydration, before the caption step opens.
    const timer = window.setTimeout(() => {
      try { setQuote(suggestAvatarCaption()); } catch { /* Keep the editable default. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [step]);

  function anotherCaption() {
    try {
      setQuote(suggestAvatarCaption()); setCard(null); setError(null);
    } catch (error) { setError(error instanceof Error ? error.message : "Please write your own caption."); }
  }

  const unavailable = accessError || (!enabled ? "Avatar generation is coming soon. Your registration is complete without it." : null);

  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const photo = data.get("photo");
    const invalid = photo instanceof File ? avatarPhotoError(photo.size, photo.type) : "Choose a photo.";
    if (invalid) { setError(invalid); return; }
    const startedAt = Date.now();
    setCreating("loading");
    setBusy(true); setActivity("Creating your avatar. This can take a few minutes; keep this page open."); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/avatar", { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Please try again later.");
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reducedMotion) {
        await new Promise(resolve => window.setTimeout(resolve, Math.max(0, 650 - (Date.now() - startedAt))));
        setCreating("leaving");
        await new Promise(resolve => window.setTimeout(resolve, 240));
      }
      setVersion(result.version); setCard(null); setPhotoPreview(null); setShared(false); setShareConsent(true); form.reset();
      anotherCaption(); setStep("caption"); setNotice(null);
    } catch (error) { setError(error instanceof Error ? error.message : "Generation failed. Try again later."); }
    finally { setBusy(false); setCreating("idle"); }
  }

  async function remove() {
    if (!window.confirm("Delete your saved avatar? Downloaded copies won't be affected.")) return;
    setBusy(true); setActivity("Deleting your avatar…"); setError(null);
    try {
      const response = await fetch("/api/avatar", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete your avatar. Please retry.");
      setVersion(null); setStep("photo"); setCard(null); setShared(false); setShareConsent(true); setNotice("Your saved avatar and any Instagram permission were deleted.");
    } catch (error) { setError(error instanceof Error ? error.message : "Please retry."); }
    finally { setBusy(false); }
  }

  async function previewCard() {
    setBusy(true); setActivity("Preparing your card…"); setError(null);
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
      setCard(canvas.toDataURL("image/png")); setStep("save"); setNotice(null);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not make your card."); }
    finally { setBusy(false); }
  }

  async function updateSharing(approve: boolean) {
    if (approve && (!card || !shareConsent)) return;
    setBusy(true); setActivity(approve ? "Saving your Instagram permission…" : "Removing your Instagram permission…"); setError(null); setNotice(null);
    try {
      const body = new FormData();
      if (approve) {
        body.set("card", await (await fetch(card!)).blob(), "rubsta-open-avatar.png");
        body.set("version", String(version));
        body.set("consent", "yes");
      }
      const response = await fetch("/api/avatar/sharing", { method: approve ? "POST" : "DELETE", ...(approve ? { body } : {}) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save your choice. Please try again.");
      setShared(approve);
      if (!approve) setShareConsent(false);
      setNotice(approve ? "Permission saved. Rubsta’s team can now download this card for its Instagram account. Nothing has been posted automatically." : "Permission removed. Your card is no longer available to the team for posting. Posts or copies already made are not removed.");
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save your choice."); }
    finally { setBusy(false); }
  }

  return (
    <section id="avatar" aria-labelledby="avatar-heading" className="bg-club-paper p-5 sm:p-8">
      <ol aria-label="Avatar steps" className="mb-6 grid grid-cols-3 gap-2 border-b border-club-line pb-4">
        {(["photo", "caption", "save"] as const).map((item, index) => <li key={item}>
          <button type="button" aria-current={step === item ? "step" : undefined}
            disabled={busy || (item === "photo" && !!version) || (item === "caption" && !version) || (item === "save" && !card)}
            className={`flex min-h-11 w-full items-center justify-center gap-2 text-[12px] disabled:opacity-40 ${step === item ? "font-semibold" : "text-club-muted"}`}
            onClick={() => { if (item !== "photo") setPhotoPreview(null); setStep(item); setError(null); setNotice(null); }}>
            <span aria-hidden="true" className={`flex h-6 w-6 items-center justify-center rounded-full ${step === item ? "bg-club-forest text-club-cream" : "border border-club-line"}`}>{index + 1}</span>
            {item === "photo" ? "Photo" : item === "caption" ? "Caption" : "Save"}
          </button>
        </li>)}
      </ol>
      <h2 ref={heading} tabIndex={-1} id="avatar-heading" className="scroll-mt-5 font-serif text-[30px] leading-tight outline-none">
        {step === "photo" ? creating !== "idle" ? "Creating your avatar." : "Start with your photo." : step === "caption" ? "Give it your voice." : "Your card is ready."}
      </h2>

      {step === "photo" ? <>
        {creating === "idle" ? <p className="mt-3 text-[13px] text-club-muted">Choose a clear photo of just you. Nothing is posted automatically.</p> : null}
        {creating !== "idle" ? <div role="status" className={`${styles.loader} ${creating === "leaving" ? styles.leaving : ""}`}>
          <div className={styles.ball} aria-hidden="true" />
          <p className="mt-8 font-serif text-[25px]">A little tennis magic.</p>
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-club-muted">This can take a few minutes. Keep this page open—we’ll reveal your avatar here.</p>
        </div> : null}
        {unavailable ? <p className="mt-4 text-[13px]" role="status">{unavailable}</p> : (
          <form onSubmit={generate} className={creating !== "idle" ? "hidden" : "mt-5 flex max-w-xl flex-col gap-4"}>
            <input ref={photoInput} aria-label="Your photo" className="sr-only" tabIndex={-1} name="photo" type="file" accept="image/jpeg,image/png,image/webp" required disabled={busy} onChange={event => {
              const selected = event.target.files?.[0] ?? null;
              const invalid = selected ? avatarPhotoError(selected.size, selected.type) : null;
              setError(invalid); setPhotoPreview(!invalid && selected ? URL.createObjectURL(selected) : null);
            }} />
            <button type="button" className={`pill ${photoPreview ? "pill-outline" : "pill-primary"} self-start`} disabled={busy} onClick={() => photoInput.current?.click()}>
              {photoPreview ? "Change photo" : "Upload photo"}
            </button>
            <p className="text-[12px] text-club-muted">JPG, PNG or WebP · Up to 5 MB</p>
            {photoPreview ? <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoPreview} alt="Your selected photo" className="h-32 w-32 object-cover" />
              <p className="text-[12px] leading-relaxed text-club-muted">OpenAI processes your photo to create the avatar. Rubsta does not save the original. Up to three attempts per day.</p>
              <label className="flex items-start gap-3 text-[12px] leading-relaxed">
                <input type="checkbox" name="consent" value="yes" required disabled={busy} className="mt-1 h-4 w-4 shrink-0" />
                I am 18 or older, this is my photo, and I agree to it being processed by OpenAI. This does not give Rubsta permission to post it.
              </label>
              <button className="pill pill-primary self-start" type="submit" disabled={busy}>{busy ? "Creating your avatar…" : "Generate my tennis avatar"}</button>
            </> : null}
          </form>
        )}

      </> : null}

      {step === "caption" && version ? <div className={`${styles.reveal} mt-5 grid gap-5 sm:grid-cols-2 sm:gap-8`}>
        {/* Private image: do not send it through the public image optimizer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/avatar?v=${version}`} alt="Your illustrated tennis avatar" className="mx-auto h-36 w-36 border border-club-line bg-club-cream object-contain sm:h-auto sm:w-full sm:max-w-sm" />
        <div className="flex min-w-0 flex-col items-start gap-4">
          <label className="w-full text-[13px]">Your caption
            <textarea rows={3} className="field mt-2 w-full" maxLength={AVATAR_MAX_QUOTE} value={quote} onChange={event => { setQuote(event.target.value); setCard(null); }} disabled={busy} />
          </label>
          <div className="flex w-full items-center justify-between gap-3">
            <button type="button" className="min-h-11 text-[12px] underline" onClick={anotherCaption} disabled={busy}>↻ Suggest another caption</button>
            <span className="text-[11px] text-club-muted">{quote.length}/{AVATAR_MAX_QUOTE}</span>
          </div>
          <p className="text-[12px] text-club-muted">Keep the suggestion, shuffle it, or write your own.</p>
          <button type="button" className="pill pill-primary" onClick={() => void previewCard()} disabled={busy}>Preview my card →</button>
        </div>
      </div> : null}

      {step === "save" && version && card ? <div className="mt-5 grid gap-5 sm:grid-cols-2 sm:gap-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={card} alt="Your Instagram card preview" className="mx-auto w-52 max-w-full border border-club-line bg-club-cream sm:w-full sm:max-w-sm" />
        <div className="flex min-w-0 flex-col items-start gap-4">
          {!accessError ? <>
            <label className="flex items-start gap-3 text-[12px] leading-relaxed">
              <input type="checkbox" checked={shareConsent} onChange={event => setShareConsent(event.target.checked)} disabled={busy} className="mt-1 h-4 w-4 shrink-0" />
              {AVATAR_SHARE_CONSENT}
            </label>
            <button type="button" className="pill pill-primary" disabled={busy || !shareConsent} onClick={() => void updateSharing(true)}>{shared ? "Approve this updated card" : "Allow Rubsta to post this card"}</button>
          </> : null}
          <a className="pill pill-outline" href={card} download="rubsta-open-avatar.png">Download my card</a>
          <p className="text-[12px] leading-relaxed text-club-muted">Downloading alone does not give us permission. Nothing is posted automatically.</p>
          <button type="button" className="min-h-11 text-[12px] underline" disabled={busy} onClick={() => { setStep("caption"); setNotice(null); }}>Edit caption</button>
          <p className="text-[11px] leading-relaxed text-club-muted">1080 × 1350 PNG. You can withdraw permission in Avatar options; posts or copies already made cannot be recalled.</p>
        </div>
      </div> : null}

      {busy && creating === "idle" ? <p role="status" className="mt-5 text-[13px]">{activity}</p> : null}
      {error ? <p role="alert" className="mt-5 text-[13px] text-bad">{error}</p> : null}
      {notice ? <p role="status" className="mt-5 text-[13px]">{notice}</p> : null}
      {version ? <details className="mt-6 border-t border-club-line pt-3">
        <summary className="min-h-11 cursor-pointer py-3 text-[12px] text-club-muted">Avatar options</summary>
        <div className="flex flex-col items-start gap-3 pb-3 text-[12px]">
          <a className="flex min-h-11 items-center underline" href={`/api/avatar?v=${version}`} download="rubsta-tennis-avatar.png">Download avatar only</a>
          {shared ? <>
            <p className="leading-relaxed text-club-muted">A card is approved for Rubsta’s Instagram. Editing your caption does not change that approved card.</p>
            <button type="button" className="min-h-11 underline" onClick={() => void updateSharing(false)} disabled={busy}>Withdraw Instagram permission</button>
          </> : null}
          <button type="button" className="min-h-11 underline" onClick={() => void remove()} disabled={busy}>Delete saved avatar</button>
        </div>
      </details> : null}
    </section>
  );
}
