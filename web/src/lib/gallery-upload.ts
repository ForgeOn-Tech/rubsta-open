import sharp from "sharp";
import { GALLERY_MAX_BYTES } from "./gallery";

/** Bound the full request, even when a client omits Content-Length. */
export async function galleryForm(request: Request): Promise<FormData> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Choose a photo and a player.");
  let size = 0;
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > GALLERY_MAX_BYTES + 64 * 1024) {
      await reader.cancel();
      throw new Error("Choose a photo smaller than 5 MB.");
    }
    chunks.push(new Uint8Array(value));
  }
  try {
    return await new Response(new Blob(chunks), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
  } catch { throw new Error("Could not read this upload. Try another photo."); }
}

export async function prepareGalleryPhoto(file: File): Promise<string> {
  if (!file.size || file.size > GALLERY_MAX_BYTES) throw new Error("Choose a photo smaller than 5 MB.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPG, PNG or WebP photo.");
  try {
    const source = sharp(new Uint8Array(await file.arrayBuffer()), { limitInputPixels: 40_000_000, failOn: "error" });
    const meta = await source.metadata();
    if (!["jpeg", "png", "webp"].includes(meta.format ?? "") || (meta.pages ?? 1) !== 1) throw new Error("Unsupported image");
    // Keep the entire photograph and remove camera/location metadata.
    return (await source.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()).toString("base64");
  } catch { throw new Error("This photo could not be read. Try another JPG, PNG or WebP."); }
}
