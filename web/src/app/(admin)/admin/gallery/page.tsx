/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { requireAdmin } from "@/auth/require";
import { getDb } from "@/db/client";
import { listGallery } from "@/db/gallery";
import { getCurrentTournament } from "@/db/queries";
import { GALLERY_LABELS } from "@/lib/gallery";
export const dynamic = "force-dynamic";
export default async function AdminGalleryPage({ searchParams }: { searchParams: Promise<{ saved?: string; page?: string }> }) {
  await requireAdmin();
  const query = await searchParams;
  const value = Number(query.page ?? 1);
  const page = Number.isSafeInteger(value) && value > 0 && value <= 10000 ? value : 1;
  const tournament = getCurrentTournament();
  const photos = tournament ? listGallery(getDb(), { tournamentId: tournament.id, admin: true, limit: 25, offset: (page - 1) * 24 }) : [];
  return <div className="p-5 sm:p-8">
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">{tournament?.name ?? "Rubsta Open"}</p><h1 className="mt-2 font-serif text-4xl">Winners & gallery</h1><p className="mt-3 max-w-xl text-sm text-muted">Celebrate winners, standout players and tournament moments. Save photos as drafts, then publish them to the website and player profiles.</p></div><div className="flex gap-3"><Link href="/gallery" target="_blank" className="btn btn-outline">View public gallery ↗</Link><Link href="/admin/gallery/new" className="btn btn-primary">Add photo</Link></div></div>
    {["draft", "published"].includes(query.saved ?? "") && <p role="status" className="mb-6 border border-line bg-surface-1 p-4 text-sm">{query.saved === "published" ? "Photo published to the website and player profiles." : "Draft saved. This photo is not visible to visitors."}</p>}
    {!photos.length ? <p className="border border-line p-8 text-muted">No photos yet. Choose Add photo to get started.</p> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{photos.slice(0, 24).map(photo => <article key={photo.id} className="overflow-hidden border border-line bg-surface-1">
      <img src={photo.imageUrl} alt={photo.title} loading="lazy" className="aspect-[4/3] w-full object-contain" />
      <div className="p-4"><p className="text-xs font-semibold uppercase tracking-wide">{photo.published ? "Published" : "Draft"} · {GALLERY_LABELS[photo.kind]}</p><h2 className="mt-2 break-words font-serif text-2xl">{photo.title}</h2><p className="mt-2 text-sm text-muted">{photo.players.join(" & ")}{photo.event ? ` · ${photo.event}` : ""}</p><Link href={`/admin/gallery/${photo.id}`} className="mt-4 inline-block text-sm underline">Edit photo →</Link></div>
    </article>)}</div>}
    <div className="mt-8 flex gap-6">{page > 1 && <Link href={`/admin/gallery?page=${page - 1}`}>← Previous</Link>}{photos.length > 24 && <Link href={`/admin/gallery?page=${page + 1}`}>More photos →</Link>}</div>
  </div>;
}
