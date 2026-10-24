import sharp from "sharp";

export { PROFILE_PHOTO_CONSENT } from "./profile-photo-consent";

export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** Big enough for the 1080-wide story card, small enough to keep in the database. */
export const PROFILE_PHOTO_SIZE = 800;
const PROFILE_PHOTO_QUALITY = 85;
const MAX_INPUT_PIXELS = 25_000_000;
const ADULT_AGE = 18;

/** Why this player cannot add a photo, or null when they can. Same age rule as photo avatars. */
export function profilePhotoAccessError(age: number | null): string | null {
  if (age === null) return "Add your date of birth to your profile first, so we can check your age.";
  if (age < ADULT_AGE) return "Profile photos are for players aged 18 and over. Your card shows your initials instead.";
  return null;
}

export function profilePhotoFileError(size: number, type: string): string | null {
  if (size === 0 || size > PROFILE_PHOTO_MAX_BYTES) return "Choose a photo smaller than 5 MB.";
  if (!PROFILE_PHOTO_TYPES.includes(type)) return "Choose a JPG, PNG or WebP photo.";
  return null;
}

/**
 * Turns an upload into the stored photo: turned upright, cropped square around the
 * most interesting part (usually the face), and saved as a fresh JPEG. Re-encoding drops
 * the camera's metadata, including any location.
 */
export async function prepareProfilePhoto(bytes: Uint8Array): Promise<Buffer> {
  const source = sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
  const metadata = await source.metadata();
  if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) {
    throw new Error(`Unsupported photo format: ${metadata.format ?? "unknown"}.`);
  }
  return source
    .rotate()
    .resize(PROFILE_PHOTO_SIZE, PROFILE_PHOTO_SIZE, { fit: "cover", position: sharp.strategy.attention })
    .jpeg({ quality: PROFILE_PHOTO_QUALITY })
    .toBuffer();
}
