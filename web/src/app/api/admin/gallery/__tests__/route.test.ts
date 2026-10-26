// @vitest-environment node
import SQLite from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import sharp from "sharp";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { upsertProfile } from "@/db/profiles";
import { seedTournamentIfEmpty } from "@/db/seed";
import { galleryEditorPhoto, listGallery } from "@/db/gallery";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), db: vi.fn(), tournament: vi.fn() }));
vi.mock("@/auth/auth", () => ({ auth: mocks.auth }));
vi.mock("@/db/client", () => ({ getDb: mocks.db }));
vi.mock("@/db/queries", () => ({ getCurrentTournament: mocks.tournament }));
import { POST } from "../route";
import { GET as publicImage } from "../../../gallery/[id]/image/route";
import { GET as adminImage } from "../[id]/image/route";
const ORIGIN = "https://rubsta.test";
let sqlite: SQLite.Database;
let db: ReturnType<typeof drizzle<typeof schema>>;
let jpeg: Buffer;
beforeEach(async () => {
  vi.stubEnv("AUTH_URL", ORIGIN); vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
  sqlite = new SQLite(":memory:"); sqlite.pragma("foreign_keys=ON");
  db = drizzle(sqlite, { schema }); migrate(db, { migrationsFolder: "./drizzle" }); seedTournamentIfEmpty(db);
  for (const id of ["first", "second"]) {
    db.insert(schema.users).values({ id, email: `${id}@example.com` }).run();
    upsertProfile(db, id, { fullName: `Player ${id}`, dateOfBirth: "2000-01-01", gender: "male", mobile: "123", club: null, bestRanking: null, previousTournaments: [], plays: null });
  }
  mocks.db.mockReturnValue(db); mocks.tournament.mockReturnValue(db.select().from(schema.tournaments).get());
  mocks.auth.mockResolvedValue({ user: { id: "admin", email: "admin@example.com" } });
  jpeg = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: "#306050" } }).withMetadata({ exif: { IFD0: { Make: "Test camera" } } }).jpeg().toBuffer();
});
afterEach(() => { sqlite.close(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
function request(values: Record<string, string> = {}, image = true, origin = ORIGIN) {
  const body = new FormData();
  for (const [key, value] of Object.entries({ playerId: "first", secondPlayerId: "second", title: "Doubles champions", caption: "A great final", kind: "winner", category: "OD", intent: "draft", ...values })) body.set(key, value);
  if (image) body.set("photo", new File([new Uint8Array(jpeg)], "photo.jpg", { type: "image/jpeg" }));
  return new Request(`${ORIGIN}/api/admin/gallery`, { method: "POST", headers: { origin }, body });
}
const imageRequest = (id: string) => [new Request(`${ORIGIN}/api/gallery/${id}/image`), { params: Promise.resolve({ id }) }] as const;
it("keeps drafts and image bytes private, publishes to both players and revokes access on unpublish", async () => {
  const saved = await POST(request()); expect(saved.status).toBe(200); const { id } = await saved.json();
  expect(listGallery(db)).toEqual([]);
  expect((await publicImage(...imageRequest(id))).status).toBe(404);
  expect((await adminImage(...imageRequest(id))).status).toBe(200);
  expect((await POST(request({ id, version: "1", intent: "publish" }, false))).status).toBe(200);
  for (const playerId of ["first", "second"]) expect(listGallery(db, { playerId })).toHaveLength(1);
  const photo = listGallery(db)[0];
  expect(photo).toMatchObject({ players: ["Player first", "Player second"], event: "Open doubles", kind: "winner" });
  expect(photo).not.toHaveProperty("playerId"); expect(photo).not.toHaveProperty("jpeg");
  const image = await publicImage(...imageRequest(id)); expect(image.status).toBe(200); expect(image.headers.get("cache-control")).toBe("no-store");
  const meta = await sharp(new Uint8Array(await image.arrayBuffer())).metadata();
  expect([meta.width, meta.height]).toEqual([1600, 800]); expect(meta.exif).toBeUndefined();
  expect((await POST(request({ id, version: "2", intent: "draft" }, false))).status).toBe(200);
  expect(listGallery(db)).toEqual([]); expect((await publicImage(...imageRequest(id))).status).toBe(404);
});
it("refuses unauthenticated, non-admin and cross-origin writes", async () => {
  mocks.auth.mockResolvedValue(null); expect((await POST(request())).status).toBe(401);
  mocks.auth.mockResolvedValue({ user: { id: "first", email: "first@example.com" } });
  expect((await POST(request())).status).toBe(403); expect((await adminImage(...imageRequest("anything"))).status).toBe(403);
  mocks.auth.mockResolvedValue({ user: { id: "admin", email: "admin@example.com" } });
  expect((await POST(request({}, true, "https://elsewhere.test"))).status).toBe(403);
});
it("validates players, content, file bytes and conflicting edits", async () => {
  const invalidFields: Record<string, string>[] = [{ playerId: "unknown" }, { secondPlayerId: "first" }, { title: "" }, { category: "FAKE" }, { kind: "FAKE" }, { caption: "x".repeat(1001) }, { intent: "delete" }];
  for (const fields of invalidFields) expect((await POST(request(fields))).status).toBe(400);
  expect((await POST(request({}, false))).status).toBe(400);
  const { id } = await (await POST(request())).json();
  expect((await POST(request({ id, version: "0", title: "Stale edit" }, false))).status).toBe(409);
  expect(galleryEditorPhoto(db, id)?.title).toBe("Doubles champions");
  jpeg = Buffer.from("not an image"); expect((await POST(request())).status).toBe(400);
  jpeg = Buffer.alloc(5 * 1024 * 1024 + 1); expect((await POST(request())).status).toBe(400);
});
