import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/auth/require";
import { getDb } from "@/db/client";
import { galleryEditorPhoto, galleryPlayers } from "@/db/gallery";
import { GalleryForm } from "../gallery-form";
export const dynamic = "force-dynamic";
export default async function GalleryEditor({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const initial = id === "new" ? null : galleryEditorPhoto(getDb(), id);
  if (id !== "new" && !initial) notFound();
  const players = galleryPlayers(getDb());
  return <div className="mx-auto max-w-6xl p-5 sm:p-8"><Link href="/admin/gallery" className="text-sm underline">← Gallery</Link><h1 className="my-6 font-serif text-4xl">{initial ? "Edit photo" : "Add a tournament photo"}</h1>
    {players.length ? <GalleryForm players={players} initial={initial} /> : <p>Add a player profile before uploading tournament photos. <Link href="/admin/players" className="underline">Open players</Link>.</p>}
  </div>;
}
