import { and, eq } from "drizzle-orm";
import { auth } from "@/auth/auth";
import { getDb } from "@/db/client";
import { deleteAvatar, finishAvatar, reserveAvatar } from "@/db/avatars";
import { entries, playerAvatars, profiles } from "@/db/schema";
import { ageFromDob } from "@/lib/age";
import { avatarAccessError, avatarPhotoError, AVATAR_MAX_BYTES } from "@/lib/avatar";
import { generateAvatar, prepareAvatarPhoto } from "@/lib/avatar-openai";

export const runtime = "nodejs";
export const maxDuration = 240;
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const fail = (error: string, status: number) => Response.json({ error }, { status, headers });

function sameOrigin(request: Request) {
  const expected = process.env.AUTH_URL ? new URL(process.env.AUTH_URL).origin : new URL(request.url).origin;
  return request.headers.get("origin") === expected;
}

export async function GET() {
  const userId = (await auth())?.user?.id;
  if (!userId) return fail("Sign in first.", 401);
  const avatar = getDb().select().from(playerAvatars).where(eq(playerAvatars.userId, userId)).get();
  if (!avatar?.png) return fail("No avatar yet.", 404);
  return new Response(new Uint8Array(Buffer.from(avatar.png, "base64")), { headers: { ...headers, "Content-Type": "image/png" } });
}

export async function POST(request: Request) {
  const userId = (await auth())?.user?.id;
  if (!userId) return fail("Sign in first.", 401);
  if (!sameOrigin(request)) return fail("Please generate from your player home.", 403);
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return fail("Avatar generation is not enabled yet. Your registration is unaffected.", 503);
  const database = getDb();
  const profile = database.select().from(profiles).where(eq(profiles.userId, userId)).get();
  const paid = database.select({ id: entries.id }).from(entries)
    .where(and(eq(entries.userId, userId), eq(entries.status, "paid"))).get();
  const access = avatarAccessError(profile ? ageFromDob(profile.dateOfBirth) : null, !!paid);
  if (access) return fail(access, 403);

  // Bound actual streamed bytes, not just the untrusted Content-Length header.
  let size = 0;
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  const reader = request.body?.getReader();
  if (!reader) return fail("Choose a photo.", 400);
  let form: FormData;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > AVATAR_MAX_BYTES + 64 * 1024) { await reader.cancel(); return fail("Choose a photo smaller than 5 MB.", 413); }
      chunks.push(new Uint8Array(value));
    }
    form = await new Response(new Blob(chunks), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
  } catch { return fail("Could not read this photo. Choose another file.", 400); }
  if (form.get("consent") !== "yes") return fail("Please give permission to process your photo.", 400);
  const photo = form.get("photo");
  if (!(photo instanceof File)) return fail("Choose a photo.", 400);
  const invalid = avatarPhotoError(photo.size, photo.type);
  if (invalid) return fail(invalid, 400);
  let prepared: Buffer;
  try { prepared = await prepareAvatarPhoto(new Uint8Array(await photo.arrayBuffer())); }
  catch { return fail("This photo could not be read. Try another JPG, PNG or WebP.", 400); }
  let attempt: string;
  try { attempt = reserveAvatar(database, userId); }
  catch (error) { return fail(error instanceof Error ? error.message : "Please try later.", 429); }
  try {
    const png = await generateAvatar(prepared, key);
    finishAvatar(database, userId, attempt, png);
    return Response.json({ ok: true }, { headers });
  } catch {
    finishAvatar(database, userId, attempt);
    return fail("We couldn't generate your avatar. Try another photo later; your registration is safe.", 502);
  }
}

export async function DELETE(request: Request) {
  const userId = (await auth())?.user?.id;
  if (!userId) return fail("Sign in first.", 401);
  if (!sameOrigin(request)) return fail("Please delete from your player home.", 403);
  deleteAvatar(getDb(), userId);
  return Response.json({ ok: true }, { headers });
}
