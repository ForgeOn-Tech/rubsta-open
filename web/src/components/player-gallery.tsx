import { getDb } from "@/db/client";
import { listGallery } from "@/db/gallery";
import { GalleryGrid } from "./gallery-grid";

export function PlayerGallery({ userId }: { userId: string }) {
  const photos = listGallery(getDb(), { playerId: userId, limit: 200 });
  if (!photos.length) return null;
  return <section aria-label="Tournament photos" className="mt-10 border-t border-club-line pt-7">
    <h2 className="mb-2 font-serif text-3xl">Tournament photos</h2>
    <p className="mb-6 text-sm text-club-muted">Your moments and achievements, published by the organisers.</p>
    <GalleryGrid photos={photos} />
  </section>;
}
