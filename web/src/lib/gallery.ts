export const GALLERY_KINDS = ["winner", "runner-up", "standout", "gallery"] as const;
export type GalleryKind = (typeof GALLERY_KINDS)[number];
export const GALLERY_LABELS: Record<GalleryKind, string> = {
  winner: "Winner", "runner-up": "Runner-up", standout: "Standout player", gallery: "Gallery",
};
export const GALLERY_MAX_BYTES = 5 * 1024 * 1024;

export interface GalleryPhoto {
  id: string;
  title: string;
  caption: string;
  kind: GalleryKind;
  event: string | null;
  players: string[];
  imageUrl: string;
}
