// @vitest-environment node
import SQLite from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { upsertProfile } from "@/db/profiles";
import { seedTournamentIfEmpty } from "@/db/seed";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), db: vi.fn(), generate: vi.fn(), prepare: vi.fn() }));
vi.mock("@/auth/auth", () => ({ auth: mocks.auth }));
vi.mock("@/db/client", () => ({ getDb: mocks.db }));
vi.mock("@/lib/avatar-openai", () => ({ generateAvatar: mocks.generate, prepareAvatarPhoto: mocks.prepare }));
import { GET, POST, DELETE } from "../route";

let sqlite: SQLite.Database;
let db: ReturnType<typeof drizzle<typeof schema>>;
beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "fake-test-key");
  vi.stubEnv("AUTH_URL", "https://rubsta.test");
  sqlite = new SQLite(":memory:"); db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./drizzle" }); seedTournamentIfEmpty(db);
  db.insert(schema.users).values({ id: "player", email: "player@example.com" }).run();
  upsertProfile(db, "player", { fullName: "Player", dateOfBirth: "2000-01-01", gender: "male", mobile: "123", club: null, bestRanking: null, previousTournaments: [], plays: null });
  db.insert(schema.entries).values({ id: "entry", userId: "player", tournamentId: db.select().from(schema.tournaments).get()!.id, category: "OS", status: "paid" }).run();
  mocks.db.mockReturnValue(db);
  mocks.auth.mockResolvedValue({ user: { id: "player" } });
  mocks.prepare.mockResolvedValue(Buffer.from("prepared"));
  mocks.generate.mockResolvedValue(Buffer.from("generated").toString("base64"));
});
afterEach(() => { sqlite.close(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

function request(consent = true, origin = "https://rubsta.test") {
  const body = new FormData();
  body.set("photo", new File(["photo"], "portrait.jpg", { type: "image/jpeg" }));
  if (consent) body.set("consent", "yes");
  return new Request("https://rubsta.test/api/avatar", { method: "POST", headers: { origin }, body });
}
it("requires authentication and same-origin requests", async () => {
  mocks.auth.mockResolvedValue(null);
  expect((await POST(request())).status).toBe(401);
  expect((await GET()).status).toBe(401);
  mocks.auth.mockResolvedValue({ user: { id: "player" } });
  expect((await POST(request(true, "https://evil.test"))).status).toBe(403);
  expect(mocks.generate).not.toHaveBeenCalled();
});
it("requires explicit photo consent", async () => {
  expect((await POST(request(false))).status).toBe(400);
  expect(mocks.generate).not.toHaveBeenCalled();
});
it("fails safely when not configured", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  expect((await POST(request())).status).toBe(503);
  expect(mocks.prepare).not.toHaveBeenCalled();
});
it("requires payment and blocks minors on the server", async () => {
  db.update(schema.entries).set({ status: "submitted" }).run();
  expect((await POST(request())).status).toBe(403);
  db.update(schema.entries).set({ status: "paid" }).run();
  db.update(schema.profiles).set({ dateOfBirth: "2020-01-01" }).run();
  expect((await POST(request())).status).toBe(403);
  expect(mocks.generate).not.toHaveBeenCalled();
});
it("stores only generated art, serves it privately, and isolates accounts", async () => {
  expect((await POST(request())).status).toBe(200);
  const image = await GET();
  expect(image.headers.get("cache-control")).toBe("private, no-store");
  expect(await image.text()).toBe("generated");
  mocks.auth.mockResolvedValue({ user: { id: "other-player" } });
  expect((await GET()).status).toBe(404);
  mocks.auth.mockResolvedValue({ user: { id: "player" } });
  expect((await DELETE(request())).status).toBe(200);
  expect((await GET()).status).toBe(404);
});
it("hides provider failures and leaves an existing avatar intact", async () => {
  await POST(request());
  mocks.generate.mockRejectedValueOnce(new Error("secret provider details"));
  const response = await POST(request());
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain("secret provider");
  expect(await (await GET()).text()).toBe("generated");
});
