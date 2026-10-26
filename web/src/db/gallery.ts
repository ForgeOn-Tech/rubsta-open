import { and, asc, desc, eq, isNotNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { Database } from "./draws";
import { CATEGORY_LABELS, galleryPhotos, profiles } from "./schema";
import type { GalleryKind, GalleryPhoto } from "@/lib/gallery";

export function galleryPlayers(database: Database) {
  return database.select({ id: profiles.userId, name: profiles.fullName, number: profiles.playerNumber })
    .from(profiles).orderBy(asc(profiles.fullName)).all();
}

export function galleryEditorPhoto(database: Database, id: string) {
  return database.select({ id: galleryPhotos.id, playerId: galleryPhotos.playerId,
    secondPlayerId: galleryPhotos.secondPlayerId, title: galleryPhotos.title, caption: galleryPhotos.caption,
    kind: galleryPhotos.kind, category: galleryPhotos.category, publishedAt: galleryPhotos.publishedAt,
    version: galleryPhotos.version,
  }).from(galleryPhotos).where(eq(galleryPhotos.id, id)).get() ?? null;
}
export type GalleryEditorPhoto = NonNullable<ReturnType<typeof galleryEditorPhoto>>;

export function listGallery(database: Database, options: { tournamentId?: string; playerId?: string; kind?: GalleryKind; admin?: boolean; limit?: number; offset?: number } = {}) {
  const partner = alias(profiles, "gallery_partner");
  const rows = database.select({ id: galleryPhotos.id, title: galleryPhotos.title, caption: galleryPhotos.caption,
    kind: galleryPhotos.kind, category: galleryPhotos.category, publishedAt: galleryPhotos.publishedAt,
    version: galleryPhotos.version, player: profiles.fullName, secondPlayer: partner.fullName,
  }).from(galleryPhotos)
    .innerJoin(profiles, eq(galleryPhotos.playerId, profiles.userId))
    .leftJoin(partner, eq(galleryPhotos.secondPlayerId, partner.userId))
    .where(and(
      options.admin ? undefined : isNotNull(galleryPhotos.publishedAt),
      options.tournamentId ? eq(galleryPhotos.tournamentId, options.tournamentId) : undefined,
      options.playerId ? or(eq(galleryPhotos.playerId, options.playerId), eq(galleryPhotos.secondPlayerId, options.playerId)) : undefined,
      options.kind ? eq(galleryPhotos.kind, options.kind) : undefined,
    ))
    .orderBy(desc(galleryPhotos.createdAt), desc(galleryPhotos.id))
    .limit(options.limit ?? 24).offset(options.offset ?? 0).all();
  return rows.map(row => ({
    id: row.id, title: row.title, caption: row.caption, kind: row.kind,
    event: row.category ? CATEGORY_LABELS[row.category] : null,
    players: [row.player, ...(row.secondPlayer ? [row.secondPlayer] : [])],
    imageUrl: `${options.admin ? "/api/admin/gallery" : "/api/gallery"}/${row.id}/image?v=${row.version}`,
    ...(options.admin ? { published: row.publishedAt !== null } : {}),
  } satisfies GalleryPhoto & { published?: boolean }));
}

export function galleryImage(database: Database, id: string, admin = false) {
  return database.select({ jpeg: galleryPhotos.jpeg }).from(galleryPhotos)
    .where(and(eq(galleryPhotos.id, id), admin ? undefined : isNotNull(galleryPhotos.publishedAt))).get();
}

export function saveGalleryPhoto(database: Database, values: Omit<typeof galleryPhotos.$inferInsert, "id" | "version">, id?: string, version?: number) {
  if (!id) return database.insert(galleryPhotos).values(values).returning({ id: galleryPhotos.id }).get();
  return database.update(galleryPhotos).set({ ...values, createdAt: sql`${galleryPhotos.createdAt}`, version: sql`${galleryPhotos.version} + 1` })
    .where(and(eq(galleryPhotos.id, id), eq(galleryPhotos.version, version ?? 0)))
    .returning({ id: galleryPhotos.id }).get();
}
