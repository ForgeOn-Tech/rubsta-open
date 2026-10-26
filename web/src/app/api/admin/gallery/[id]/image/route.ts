import { auth } from "@/auth/auth";
import { canAccessAdmin } from "@/auth/require";
import { getDb } from "@/db/client";
import { galleryImage } from "@/db/gallery";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = (await auth())?.user;
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (!user?.id || !canAccessAdmin(user.email ?? "")) return new Response("Organiser access required", { status: 403, headers });
  const photo = galleryImage(getDb(), (await params).id, true);
  return photo ? new Response(Buffer.from(photo.jpeg, "base64"), { headers: { ...headers, "Content-Type": "image/jpeg" } }) : new Response("Photo not found", { status: 404, headers });
}
