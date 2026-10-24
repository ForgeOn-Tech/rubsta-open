import { eq } from "drizzle-orm";

import { auth } from "@/auth/auth";
import { getDb } from "@/db/client";
import { deleteProfilePhoto, getProfilePhoto, saveProfilePhoto } from "@/db/profile-photos";
import { profiles } from "@/db/schema";
import { ageFromDob } from "@/lib/age";
import {
  PROFILE_PHOTO_CONSENT,
  PROFILE_PHOTO_MAX_BYTES,
  prepareProfilePhoto,
  profilePhotoAccessError,
  profilePhotoFileError,
} from "@/lib/profile-photo";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const FORM_OVERHEAD_BYTES = 64 * 1024;

function fail(error: string, status: number): Response {
  return Response.json({ error }, { status, headers });
}

function sameOrigin(request: Request): boolean {
  const expected = process.env.AUTH_URL ? new URL(process.env.AUTH_URL).origin : new URL(request.url).origin;
  return request.headers.get("origin") === expected;
}

/** Reads the form, stopping once more bytes arrive than a photo may have. */
async function boundedForm(request: Request): Promise<FormData | Response> {
  const reader = request.body?.getReader();
  if (!reader) return fail("Choose a photo.", 400);
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > PROFILE_PHOTO_MAX_BYTES + FORM_OVERHEAD_BYTES) {
        await reader.cancel();
        return fail("Choose a photo smaller than 5 MB.", 413);
      }
      chunks.push(new Uint8Array(value));
    }
    return await new Response(new Blob(chunks), {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    return fail("Could not read this photo. Choose another file.", 400);
  }
}

/** The signed-in player's own photo. Nobody else's is served here. */
export async function GET(): Promise<Response> {
  const userId = (await auth())?.user?.id;
  if (!userId) return fail("Sign in first.", 401);
  const photo = getProfilePhoto(getDb(), userId);
  if (photo === null) return fail("No photo yet.", 404);
  return new Response(new Uint8Array(photo), { headers: { ...headers, "Content-Type": "image/jpeg" } });
}

export async function POST(request: Request): Promise<Response> {
  const userId = (await auth())?.user?.id;
  if (!userId) return fail("Sign in first.", 401);
  if (!sameOrigin(request)) return fail("Add your photo from your profile page.", 403);
  const database = getDb();
  const profile = database.select({ dateOfBirth: profiles.dateOfBirth }).from(profiles).where(eq(profiles.userId, userId)).get();
  const access = profilePhotoAccessError(profile ? ageFromDob(profile.dateOfBirth) : null);
  if (access) return fail(access, 403);

  const form = await boundedForm(request);
  if (form instanceof Response) return form;
  if (form.get("consent") !== "yes") return fail("Tick the box to confirm you are happy to use this photo.", 400);
  const photo = form.get("photo");
  if (!(photo instanceof File)) return fail("Choose a photo.", 400);
  const invalid = profilePhotoFileError(photo.size, photo.type);
  if (invalid) return fail(invalid, 400);

  let jpeg: Buffer;
  try {
    jpeg = await prepareProfilePhoto(new Uint8Array(await photo.arrayBuffer()));
  } catch {
    return fail("This photo could not be read. Try another JPG, PNG or WebP.", 400);
  }
  saveProfilePhoto(database, { userId, jpeg, consentText: PROFILE_PHOTO_CONSENT, now: Date.now() });
  return Response.json({ ok: true }, { headers });
}

export async function DELETE(request: Request): Promise<Response> {
  const userId = (await auth())?.user?.id;
  if (!userId) return fail("Sign in first.", 401);
  if (!sameOrigin(request)) return fail("Remove your photo from your profile page.", 403);
  deleteProfilePhoto(getDb(), userId);
  return Response.json({ ok: true }, { headers });
}
