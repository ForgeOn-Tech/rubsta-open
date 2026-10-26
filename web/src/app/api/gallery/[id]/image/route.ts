import { getDb } from "@/db/client";
import { galleryImage } from "@/db/gallery";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const photo = galleryImage(getDb(), (await params).id);
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  return photo ? new Response(Buffer.from(photo.jpeg, "base64"), { headers: { ...headers, "Content-Type": "image/jpeg" } }) : new Response("Photo not found", { status: 404, headers });
}
