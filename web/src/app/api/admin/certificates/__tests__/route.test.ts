// @vitest-environment node
import SQLite from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { SEED_TOURNAMENT } from "@/db/seed";
import { saveGeneratedDraw, getDrawWithSlots } from "@/db/draws";
import { publishDraw } from "@/db/matches";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), db: vi.fn(), tournament: vi.fn() }));
vi.mock("@/auth/auth", () => ({ auth: mocks.auth }));
vi.mock("@/db/client", () => ({ getDb: mocks.db }));
vi.mock("@/db/queries", () => ({ getCurrentTournament: mocks.tournament }));
import { listAdminCertificates } from "@/db/certificates";
import { GET } from "../[userId]/[entryId]/[kind]/route";
import { GET as playerDownload } from "@/app/(player)/home/certificates/[entryId]/[kind]/route";
let sqlite: SQLite.Database;
let db: ReturnType<typeof drizzle<typeof schema>>;
const request = new Request("https://rubsta.test/api/admin/certificates/owner/team/winner");
const params = (userId = "owner", kind = "winner", entryId = "team") => ({ params: Promise.resolve({ userId, kind, entryId }) });
beforeEach(() => {
  vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
  sqlite = new SQLite(":memory:"); db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./drizzle" });
  db.insert(schema.tournaments).values({ ...SEED_TOURNAMENT, id: "t", venue: "Nerul Gymkhana, Navi Mumbai" }).run();
  for (const id of ["owner", "partner", "opponent", "outsider"]) {
    db.insert(schema.users).values({ id, email: `${id}@example.com` }).run();
    db.insert(schema.profiles).values({ userId: id, fullName: `${id} Player`, dateOfBirth: "1990-01-01", gender: "male", mobile: "1234567890" }).run();
  }
  db.insert(schema.entries).values([
    { id: "team", userId: "owner", tournamentId: "t", category: "OD", status: "paid", partnerUserId: "partner", partnerName: "partner Player", partnerEmail: "partner@example.com", partnerStatus: "accepted" },
    { id: "opposition", userId: "opponent", tournamentId: "t", category: "OD", status: "paid" },
  ]).run();
  saveGeneratedDraw(db, { tournamentId: "t", category: "OD", lines: ["team", "opposition"].map((entryId, i) => ({ position: i + 1, entryId, seed: null })) });
  const draw = getDrawWithSlots(db, "t", "OD")!; publishDraw(db, draw.draw, draw.slots);
  db.update(schema.matches).set({ status: "completed", winnerEntryId: "team", firstServer: "top", startedAt: 1, completedAt: 2, events: Array.from({ length: 48 }, () => ({ type: "point" as const, side: "top" as const })) }).run();
  mocks.db.mockReturnValue(db); mocks.tournament.mockReturnValue(db.select().from(schema.tournaments).get());
  mocks.auth.mockResolvedValue({ user: { id: "admin", email: "admin@example.com" } });
});
afterEach(() => { sqlite.close(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
it("rejects signed-out and ordinary player access to admin downloads", async () => {
  mocks.auth.mockResolvedValue(null); expect((await GET(request, params())).status).toBe(401);
  mocks.auth.mockResolvedValue({ user: { id: "owner", email: "owner@example.com" } });
  expect((await GET(request, params())).status).toBe(403);
});
it("lists both registered doubles players and the beaten finalist's participation and runner-up", () => {
  const rows = listAdminCertificates(db, "t");
  expect(rows).toHaveLength(6);
  expect(rows.filter(row => row.kind === "winner").map(row => row.userId).sort()).toEqual(["owner", "partner"]);
  expect(rows.filter(row => row.kind === "runner-up").map(row => row.userId)).toEqual(["opponent"]);
  expect(rows.some(row => row.userId === "outsider")).toBe(false);
});
it("downloads earned PDFs for the owner and accepted partner without caching", async () => {
  for (const userId of ["owner", "partner"]) {
    const response = await GET(request, params(userId));
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Content-Disposition")).toContain("winner.pdf");
    const pdf = await PDFDocument.load(await response.arrayBuffer()); expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toBe("Winner's certificate");
  }
});
it("rejects unearned, unrelated and invalid certificate requests", async () => {
  expect((await GET(request, params("opponent", "winner", "opposition"))).status).toBe(404);
  expect((await GET(request, params("outsider"))).status).toBe(404);
  expect((await GET(request, params("owner", "invented"))).status).toBe(404);
});
it("does not give a certificate to an unaccepted partner", async () => {
  db.update(schema.entries).set({ partnerStatus: "pending" }).where(eq(schema.entries.id, "team")).run();
  expect(listAdminCertificates(db, "t").some(row => row.userId === "partner")).toBe(false);
  expect((await GET(request, params("partner"))).status).toBe(404);
});
it("preserves the player route's ownership guard", async () => {
  mocks.auth.mockResolvedValue({ user: { id: "outsider", email: "outsider@example.com" } });
  expect((await playerDownload(request, params())).status).toBe(404);
  mocks.auth.mockResolvedValue({ user: { id: "partner", email: "partner@example.com" } });
  expect((await playerDownload(request, params())).status).toBe(200);
});
