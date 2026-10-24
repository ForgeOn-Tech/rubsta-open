// @vitest-environment node
import SQLite from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";
import { upsertProfile } from "@/db/profiles";
import { seedTournamentIfEmpty } from "@/db/seed";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), db: vi.fn(), admin: vi.fn() }));
vi.mock("@/auth/auth", () => ({ auth: mocks.auth }));
vi.mock("@/auth/require", () => ({ canAccessAdmin: mocks.admin }));
vi.mock("@/db/client", () => ({
  getDb: mocks.db,
  get db() {
    return mocks.db();
  },
}));
import { GET } from "../route";

const BASE = "https://rubsta.test/api/admin/story-card/player";
let sqlite: SQLite.Database;

beforeEach(() => {
  sqlite = new SQLite(":memory:");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./drizzle" });
  seedTournamentIfEmpty(db);
  db.insert(schema.users).values({ id: "player", email: "player@example.com" }).run();
  upsertProfile(db, "player", {
    fullName: "Test Player",
    dateOfBirth: "2000-01-01",
    gender: "male",
    mobile: "123",
    club: null,
    bestRanking: null,
    previousTournaments: [],
    plays: null,
  });
  mocks.db.mockReturnValue(db);
  mocks.auth.mockResolvedValue({ user: { id: "organiser", email: "organiser@example.com" } });
  mocks.admin.mockReturnValue(true);
});
afterEach(() => {
  sqlite.close();
  vi.clearAllMocks();
});

const params = (userId: string) => ({ params: Promise.resolve({ userId }) });

it("gives an admin any player's card in the colour asked for", async () => {
  const response = await GET(new Request(`${BASE}?theme=night`), params("player"));

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("image/png");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});

it("refuses anyone who is not a signed-in admin", async () => {
  mocks.admin.mockReturnValue(false);
  expect((await GET(new Request(BASE), params("player"))).status).toBe(403);
  mocks.auth.mockResolvedValue(null);
  expect((await GET(new Request(BASE), params("player"))).status).toBe(401);
});

it("refuses an unknown colour and a player without a profile", async () => {
  expect((await GET(new Request(`${BASE}?theme=rainbow`), params("player"))).status).toBe(400);
  expect((await GET(new Request(BASE), params("nobody"))).status).toBe(404);
});
