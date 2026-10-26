import { auth } from "@/auth/auth";
import { canAccessAdmin } from "@/auth/require";
import { getDb } from "@/db/client";
import { galleryEditorPhoto, galleryImage, galleryPlayers, saveGalleryPhoto } from "@/db/gallery";
import { getCurrentTournament } from "@/db/queries";
import { CATEGORIES, type Category } from "@/db/schema";
import { GALLERY_KINDS, type GalleryKind } from "@/lib/gallery";
import { galleryForm, prepareGalleryPhoto } from "@/lib/gallery-upload";

const headers = { "Cache-Control": "private, no-store" };
const fail = (error: string, status = 400) => Response.json({ error }, { status, headers });

export async function POST(request: Request) {
  const user = (await auth())?.user;
  if (!user?.id) return fail("Sign in first.", 401);
  if (!canAccessAdmin(user.email ?? "")) return fail("Only organisers can manage the gallery.", 403);
  const origin = new URL(process.env.AUTH_URL || request.url).origin;
  if (request.headers.get("origin") !== origin) return fail("Save photos from the admin gallery page.", 403);
  const tournament = getCurrentTournament();
  if (!tournament) return fail("No tournament is set up.");

  let form: FormData;
  try { form = await galleryForm(request); } catch (error) { return fail((error as Error).message); }
  const text = (key: string) => String(form.get(key) ?? "").trim();
  const id = text("id");
  const database = getDb();
  const existing = id ? galleryEditorPhoto(database, id) : null;
  if (id && !existing) return fail("This photo was not found.", 404);
  if (existing && Number(text("version")) !== existing.version) return fail("Someone else changed this photo. Reload the page before saving.", 409);
  const playerId = text("playerId");
  const secondPlayerId = text("secondPlayerId") || null;
  const players = galleryPlayers(database);
  if (!players.some(player => player.id === playerId) || (secondPlayerId && !players.some(player => player.id === secondPlayerId))) return fail("Choose a player from the list.");
  if (playerId === secondPlayerId) return fail("Choose a different second player, or leave that field empty.");
  const title = text("title");
  const caption = text("caption");
  const kind = text("kind") as GalleryKind;
  const category = text("category") as Category | "";
  const intent = text("intent");
  if (!title || title.length > 120) return fail("Add a title of up to 120 characters.");
  if (caption.length > 1000) return fail("Keep the caption to 1,000 characters.");
  if (!GALLERY_KINDS.includes(kind)) return fail("Choose how this photo should be featured.");
  if (category && !CATEGORIES.includes(category)) return fail("Choose an event from the list.");
  if (!["draft", "publish"].includes(intent)) return fail("Choose Save draft or Publish.");
  const photo = form.get("photo");
  let jpeg: string;
  if (photo instanceof File && photo.size > 0) {
    try { jpeg = await prepareGalleryPhoto(photo); } catch (error) { return fail((error as Error).message); }
  } else {
    const saved = existing ? galleryImage(database, existing.id, true) : null;
    if (!saved) return fail("Choose a photo before saving.");
    jpeg = saved.jpeg;
  }
  const now = Date.now();
  const saved = saveGalleryPhoto(database, { tournamentId: tournament.id, playerId, secondPlayerId, title, caption, kind,
    category: category || null, jpeg, publishedAt: intent === "publish" ? existing?.publishedAt ?? now : null,
    updatedAt: now, createdAt: now,
  }, id || undefined, existing?.version);
  if (!saved) return fail("Someone else changed this photo. Reload the page before saving.", 409);
  return Response.json({ id: saved.id, published: intent === "publish" }, { headers });
}
