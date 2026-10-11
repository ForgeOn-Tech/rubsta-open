import { eq } from "drizzle-orm";
import sharp from "sharp";
import { auth } from "@/auth/auth";
import { getDb } from "@/db/client";
import { approveAvatarShare, revokeAvatarShare } from "@/db/avatars";
import { profiles } from "@/db/schema";
import { ageFromDob } from "@/lib/age";
import { AVATAR_MAX_BYTES, AVATAR_PROFILE_REQUIRED } from "@/lib/avatar";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => Response.json({ error }, { status, headers });
function sameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(process.env.AUTH_URL || request.url).origin;
}

export async function POST(request: Request) {
  const userId = (await auth())?.user?.id;
  if (!userId) return fail("Sign in first.", 401);
  if (!sameOrigin(request)) return fail("Please use your avatar page.", 403);
  const db = getDb();
  const profile = db.select().from(profiles).where(eq(profiles.userId, userId)).get();
  const age = profile ? ageFromDob(profile.dateOfBirth) : null;
  if (age === null) return fail(AVATAR_PROFILE_REQUIRED, 403);
  if (age < 18) return fail("Instagram permissions are available to players aged 18 and over.", 403);
  const reader = request.body?.getReader();
  if (!reader) return fail("Preview your card first.", 400);
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  let form: FormData;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > AVATAR_MAX_BYTES + 65536) { await reader.cancel(); return fail("This card is too large. Please make a new preview.", 413); }
      chunks.push(new Uint8Array(value));
    }
    form = await new Response(new Blob(chunks), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
  } catch { return fail("Could not read your card.", 400); }
  if (form.get("consent") !== "yes") return fail("Choose whether to give Rubsta permission to post this card.", 400);
  const file = form.get("card");
  const version = Number(form.get("version"));
  if (!(file instanceof File) || file.type !== "image/png" || file.size > AVATAR_MAX_BYTES || !Number.isSafeInteger(version) || version <= 0) return fail("Preview your card again.", 400);
  let png: string;
  try {
    const image = sharp(new Uint8Array(await file.arrayBuffer()), { limitInputPixels: 2_000_000 });
    const metadata = await image.metadata();
    if (metadata.format !== "png" || metadata.width !== 1080 || metadata.height !== 1350 || (metadata.pages ?? 1) !== 1) return fail("Use the card made by your avatar preview.", 400);
    png = (await image.png().toBuffer()).toString("base64");
  } catch { return fail("This card could not be read. Please preview it again.", 400); }
  try { approveAvatarShare(db, userId, version, png); }
  catch { return fail("Your avatar changed. Refresh and preview it again before giving permission.", 409); }
  return Response.json({ ok: true }, { headers });
}

export async function DELETE(request: Request) {
  const userId = (await auth())?.user?.id;
  if (!userId) return fail("Sign in first.", 401);
  if (!sameOrigin(request)) return fail("Please use your avatar page.", 403);
  revokeAvatarShare(getDb(), userId);
  return Response.json({ ok: true }, { headers });
}
