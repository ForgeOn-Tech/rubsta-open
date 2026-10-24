// @vitest-environment node
import SQLite from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import sharp from "sharp";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";
import { upsertProfile } from "@/db/profiles";
import { seedTournamentIfEmpty } from "@/db/seed";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), db: vi.fn() }));
vi.mock("@/auth/auth", () => ({ auth: mocks.auth }));
vi.mock("@/db/client", () => ({ getDb: mocks.db }));
import { DELETE, GET, POST } from "../route";

const ORIGIN = "https://rubsta.test";
let sqlite: SQLite.Database;
let db: ReturnType<typeof drizzle<typeof schema>>;

function profile(dateOfBirth: string) {
  upsertProfile(db, "player", {
    fullName: "Player",
    dateOfBirth,
    gender: "male",
    mobile: "123",
    club: null,
    bestRanking: null,
    previousTournaments: [],
    plays: null,
  });
}

beforeEach(() => {
  vi.stubEnv("AUTH_URL", ORIGIN);
  sqlite = new SQLite(":memory:");
  db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./drizzle" });
  seedTournamentIfEmpty(db);
  db.insert(schema.users).values({ id: "player", email: "player@example.com" }).run();
  profile("2000-01-01");
  mocks.db.mockReturnValue(db);
  mocks.auth.mockResolvedValue({ user: { id: "player" } });
});
afterEach(() => {
  sqlite.close();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

/** A real 1200×900 JPEG with camera details, like a phone photo. */
async function phonePhoto(): Promise<File> {
  const jpeg = await sharp({ create: { width: 1200, height: 900, channels: 3, background: "#3366aa" } })
    .withMetadata({ exif: { IFD0: { Make: "TestPhone" } } })
    .jpeg()
    .toBuffer();
  return new File([new Uint8Array(jpeg)], "photo.jpg", { type: "image/jpeg" });
}

function upload(photo: File, options: { consent: boolean; origin: string }): Request {
  const body = new FormData();
  body.set("photo", photo);
  if (options.consent) body.set("consent", "yes");
  return new Request(`${ORIGIN}/api/profile-photo`, { method: "POST", headers: { origin: options.origin }, body });
}

it("saves an adult's photo square, without the camera details, and serves it only to them", async () => {
  // Act
  const response = await POST(upload(await phonePhoto(), { consent: true, origin: ORIGIN }));
  const served = await GET();

  // Assert
  expect(response.status).toBe(200);
  expect(served.headers.get("content-type")).toBe("image/jpeg");
  const metadata = await sharp(new Uint8Array(await served.arrayBuffer())).metadata();
  expect([metadata.width, metadata.height]).toEqual([800, 800]);
  expect(metadata.exif).toBeUndefined();
  expect(db.select().from(schema.profilePhotos).get()?.consentText).toContain("18 or over");
});

it("refuses a player under 18 or without a date of birth", async () => {
  profile("2014-05-01");
  expect((await POST(upload(await phonePhoto(), { consent: true, origin: ORIGIN }))).status).toBe(403);
  expect(db.select().from(schema.profilePhotos).all()).toEqual([]);
});

it("needs consent, a signed-in player and a request from this site", async () => {
  expect((await POST(upload(await phonePhoto(), { consent: false, origin: ORIGIN }))).status).toBe(400);
  expect((await POST(upload(await phonePhoto(), { consent: true, origin: "https://evil.test" }))).status).toBe(403);
  mocks.auth.mockResolvedValue(null);
  expect((await POST(upload(await phonePhoto(), { consent: true, origin: ORIGIN }))).status).toBe(401);
  expect((await GET()).status).toBe(401);
});

it("refuses the wrong type, a file over 5 MB and a file that is not an image", async () => {
  const gif = new File(["gif"], "a.gif", { type: "image/gif" });
  const huge = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" });
  const fake = new File(["not an image"], "fake.jpg", { type: "image/jpeg" });

  expect((await POST(upload(gif, { consent: true, origin: ORIGIN }))).status).toBe(400);
  expect([400, 413]).toContain((await POST(upload(huge, { consent: true, origin: ORIGIN }))).status);
  expect((await POST(upload(fake, { consent: true, origin: ORIGIN }))).status).toBe(400);
});

it("removes the photo", async () => {
  await POST(upload(await phonePhoto(), { consent: true, origin: ORIGIN }));

  const response = await DELETE(new Request(`${ORIGIN}/api/profile-photo`, { method: "DELETE", headers: { origin: ORIGIN } }));

  expect(response.status).toBe(200);
  expect((await GET()).status).toBe(404);
});
