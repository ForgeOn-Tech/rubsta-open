export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_DEFAULT_QUOTE = "See you on court.";
export const AVATAR_MAX_QUOTE = 100;
export const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function avatarAccessError(age: number | null, paid: boolean): string | null {
  if (age === null || age < 18) return "Photo avatars are currently available to players aged 18 and over. Junior registration is unaffected.";
  if (!paid) return "Complete payment for an entry to unlock your optional avatar.";
  return null;
}

export function avatarPhotoError(size: number, type: string): string | null {
  if (size === 0 || size > AVATAR_MAX_BYTES) return "Choose a photo smaller than 5 MB.";
  if (!AVATAR_MIME_TYPES.includes(type)) return "Choose a JPG, PNG or WebP photo.";
  return null;
}

export function avatarQuote(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, AVATAR_MAX_QUOTE) || AVATAR_DEFAULT_QUOTE;
}
