import Link from "next/link";
import { getDb } from "@/db/client";
import { listGallery } from "@/db/gallery";
import { getCurrentTournament } from "@/db/queries";
import { GalleryGrid } from "@/components/gallery-grid";
import { GALLERY_KINDS, GALLERY_LABELS, type GalleryKind } from "@/lib/gallery";

export const dynamic = "force-dynamic";
export const metadata = { title: "Winners & Gallery · Rubsta Open" };

export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ kind?: string; page?: string }> }) {
  const query = await searchParams;
  const kind = GALLERY_KINDS.includes(query.kind as GalleryKind) ? query.kind as GalleryKind : undefined;
  const number = Number(query.page ?? 1);
  const page = Number.isSafeInteger(number) && number > 0 && number <= 10000 ? number : 1;
  const tournament = getCurrentTournament();
  const photos = tournament ? listGallery(getDb(), { tournamentId: tournament.id, kind, limit: 25, offset: (page - 1) * 24 }) : [];
  const pageHref = (value: number) => `/gallery?${new URLSearchParams({ ...(kind ? { kind } : {}), page: String(value) })}`;
  return <div>
    <p className="eyebrow">{tournament?.name ?? "Rubsta Open"}</p>
    <h1 className="mt-3 font-serif text-5xl">Winners & gallery</h1>
    <p className="mt-4 max-w-xl text-club-muted">Celebrating the players, the performances and the moments from the tournament.</p>
    <nav aria-label="Gallery filters" className="my-8 flex flex-wrap gap-2">
      {[{ label: "All photos", value: undefined }, ...GALLERY_KINDS.map(value => ({ label: GALLERY_LABELS[value], value }))].map(item => <Link key={item.label} href={item.value ? `/gallery?kind=${item.value}` : "/gallery"} aria-current={kind === item.value ? "page" : undefined} className={`border px-4 py-2 text-sm ${kind === item.value ? "border-club-forest bg-club-forest !text-white" : "border-club-line"}`}>{item.label}</Link>)}
    </nav>
    {photos.length ? <GalleryGrid photos={photos.slice(0, 24)} /> : <p className="border border-club-line p-8 text-club-muted">No photos published here yet. Check back for tournament moments.</p>}
    <div className="mt-8 flex gap-6">{page > 1 && <Link href={pageHref(page - 1)}>← Previous photos</Link>}{photos.length > 24 && <Link href={pageHref(page + 1)}>More photos →</Link>}</div>
    <Link href="/results" className="mt-8 inline-block underline">View match results →</Link>
  </div>;
}
