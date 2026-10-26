/* eslint-disable @next/next/no-img-element */
import type { GalleryPhoto } from "@/lib/gallery";
import { GALLERY_LABELS } from "@/lib/gallery";

export function GalleryGrid({ photos }: { photos: GalleryPhoto[] }) {
  return <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
    {photos.map(photo => <article key={photo.id} className="min-w-0 overflow-hidden border border-club-line bg-white/50">
      <a href={photo.imageUrl} target="_blank" rel="noreferrer" aria-label={`View photo: ${photo.title}`} className="block bg-black/5">
        <img src={photo.imageUrl} alt={photo.title} loading="lazy" className="aspect-[4/3] w-full object-contain" />
      </a>
      <div className="p-4"><p className="text-[10px] font-semibold uppercase tracking-widest text-club-muted">{GALLERY_LABELS[photo.kind]}{photo.event ? ` · ${photo.event}` : ""}</p>
        <h3 className="mt-2 break-words font-serif text-2xl">{photo.title}</h3>
        <p className="mt-2 text-sm font-medium">{photo.players.join(" & ")}</p>
        {photo.caption && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-club-muted">{photo.caption}</p>}
      </div>
    </article>)}
  </div>;
}
