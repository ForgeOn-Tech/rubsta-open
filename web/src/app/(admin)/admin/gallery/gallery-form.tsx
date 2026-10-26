"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { GalleryEditorPhoto } from "@/db/gallery";
import { CATEGORIES, CATEGORY_LABELS } from "@/db/schema";
import { GALLERY_KINDS, GALLERY_LABELS, GALLERY_MAX_BYTES } from "@/lib/gallery";

export function GalleryForm({ players, initial }: { players: { id: string; name: string; number: number | null }[]; initial: GalleryEditorPhoto | null }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    form.set("intent", ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value ?? "draft");
    if (!file && !initial) { setError("Choose a photo before saving."); return; }
    setError(""); setBusy(true);
    try {
      const response = await fetch("/api/admin/gallery", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save this photo.");
      router.push(`/admin/gallery?saved=${result.published ? "published" : "draft"}`);
      router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save. Try again."); setBusy(false); }
  }
  const image = preview ?? (initial ? `/api/admin/gallery/${initial.id}/image?v=${initial.version}` : null);
  const options = players.map(player => <option key={player.id} value={player.id}>{player.name}{player.number ? ` · Player ${player.number}` : ""}</option>);
  return <form onSubmit={save} className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
    <input type="hidden" name="id" value={initial?.id ?? ""} /><input type="hidden" name="version" value={initial?.version ?? ""} />
    <div><div className="flex min-h-64 items-center justify-center border border-line bg-surface-1 p-3">
      {image ? <img src={image} alt="Selected photo preview" className="max-h-[480px] w-full object-contain" /> : <p className="p-8 text-center text-sm text-muted">Your photo preview will appear here.</p>}
    </div><label className="mt-4 block text-sm font-medium" htmlFor="gallery-photo">{initial ? "Replace photo (optional)" : "Upload photo"}</label>
      <input id="gallery-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="mt-3 block w-full text-sm" onChange={event => {
        const next = event.target.files?.[0] ?? null;
        if (next && (next.size > GALLERY_MAX_BYTES || !["image/jpeg", "image/png", "image/webp"].includes(next.type))) {
          setError("Choose a JPG, PNG or WebP smaller than 5 MB."); event.target.value = ""; setFile(null); setPreview(null); return;
        }
        setError(""); setFile(next); setPreview(next ? URL.createObjectURL(next) : null);
      }} disabled={busy} />
      <p className="mt-2 text-xs text-muted">JPG, PNG or WebP · Up to 5 MB. The full photo is kept.</p>
    </div>
    <fieldset disabled={busy} className="min-w-0 space-y-4">
      <label className="block text-sm">Player<select required name="playerId" defaultValue={initial?.playerId ?? ""} className="field"><option value="">Choose a player</option>{options}</select></label>
      <label className="block text-sm">Second player (optional, for doubles)<select name="secondPlayerId" defaultValue={initial?.secondPlayerId ?? ""} className="field"><option value="">No second player</option>{options}</select></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">Feature as<select name="kind" defaultValue={initial?.kind ?? "gallery"} className="field">{GALLERY_KINDS.map(kind => <option key={kind} value={kind}>{GALLERY_LABELS[kind]}</option>)}</select></label>
        <label className="block text-sm">Event<select name="category" defaultValue={initial?.category ?? ""} className="field"><option value="">General tournament photo</option>{CATEGORIES.map(category => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}</select></label>
      </div>
      <label className="block text-sm">Photo title<input required name="title" maxLength={120} defaultValue={initial?.title ?? ""} placeholder="e.g. Open singles champion" className="field" /></label>
      <label className="block text-sm">Caption (optional)<textarea name="caption" maxLength={1000} defaultValue={initial?.caption ?? ""} rows={4} className="field" /></label>
      <p className="text-sm text-muted">Publishing shows this photo on the website and in each tagged player’s profile. Saving a draft keeps it private{initial?.publishedAt ? " and removes the published photo from those pages" : ""}.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-3"><button type="submit" value="draft" className="btn btn-outline">{busy ? "Saving…" : initial?.publishedAt ? "Unpublish & save draft" : "Save draft"}</button><button type="submit" value="publish" className="btn btn-primary">{initial?.publishedAt ? "Save & publish changes" : "Save & publish"}</button><Link href="/admin/gallery" className="px-3 py-2 text-sm underline">Cancel</Link></div>
    </fieldset>
  </form>;
}
