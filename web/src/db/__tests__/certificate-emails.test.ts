// @vitest-environment node
import SQLite from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getDrawWithSlots, saveGeneratedDraw } from "@/db/draws";
import { publishDraw } from "@/db/matches";
import * as schema from "@/db/schema";
import { SEED_TOURNAMENT } from "@/db/seed";
import {
  certificateKey,
  listCertificateEmailStatuses,
  queueAllCertificateEmails,
  queueCertificateEmail,
} from "../certificate-emails";

const NOW = 1_800_000_000_000;
const ADMIN = "Admin@Example.com";
const WINNER = { userId: "owner", entryId: "team", kind: "winner" as const };

let sqlite: SQLite.Database;
let db: ReturnType<typeof drizzle<typeof schema>>;

const rows = () => db.select().from(schema.certificateEmails).all();

beforeEach(() => {
  sqlite = new SQLite(":memory:");
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./drizzle" });
  db.insert(schema.tournaments).values({ ...SEED_TOURNAMENT, id: "t", venue: "Nerul Gymkhana, Navi Mumbai" }).run();
  for (const [index, id] of ["owner", "partner", "opponent"].entries()) {
    db.insert(schema.users).values({ id, email: `${id}@example.com` }).run();
    db.insert(schema.profiles).values({ userId: id, fullName: `${id} Player`, dateOfBirth: "1990-01-01", gender: "male", mobile: "1234567890", playerNumber: index + 1 }).run();
  }
  db.insert(schema.entries).values([
    { id: "team", userId: "owner", tournamentId: "t", category: "OD", status: "paid", partnerUserId: "partner", partnerName: "partner Player", partnerEmail: "partner@example.com", partnerStatus: "accepted" },
    { id: "opposition", userId: "opponent", tournamentId: "t", category: "OD", status: "paid" },
  ]).run();
  saveGeneratedDraw(db, { tournamentId: "t", category: "OD", lines: ["team", "opposition"].map((entryId, i) => ({ position: i + 1, entryId, seed: null })) });
  const draw = getDrawWithSlots(db, "t", "OD")!;
  publishDraw(db, draw.draw, draw.slots);
  db.update(schema.matches).set({
    status: "completed", winnerEntryId: "team", firstServer: "top", startedAt: 1, completedAt: 2,
    events: Array.from({ length: 48 }, () => ({ type: "point" as const, side: "top" as const })),
  }).run();
});
afterEach(() => sqlite.close());

describe("queueAllCertificateEmails", () => {
  it("queues every earned certificate once, to each player's own email", async () => {
    const first = await queueAllCertificateEmails(db, "t", ADMIN, NOW);
    const second = await queueAllCertificateEmails(db, "t", ADMIN, NOW + 1);

    expect(first).toEqual({ queued: 6, skipped: 0, unprintable: [] });
    expect(second).toEqual({ queued: 0, skipped: 6, unprintable: [] });
    expect(rows().filter(row => row.kind === "winner").map(row => row.recipient).sort())
      .toEqual(["owner@example.com", "partner@example.com"]);
    expect(rows().find(row => row.kind === "runner-up")?.recipient).toBe("opponent@example.com");
    expect(new Set(rows().map(row => row.queuedBy))).toEqual(new Set(["admin@example.com"]));
  });

  it("attaches a PDF in the saved request", async () => {
    await queueAllCertificateEmails(db, "t", ADMIN, NOW);

    const body = JSON.parse(rows().find(row => row.userId === "owner" && row.kind === "winner")!.requestBody);
    expect(body.attachments[0].filename).toBe("rubsta-open-2026-open-doubles-winner.pdf");
    expect(Buffer.from(body.attachments[0].content, "base64").subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("reports players whose names the certificate cannot print, and queues the rest", async () => {
    db.update(schema.profiles).set({ fullName: "गौरव पिल्लई" }).where(eq(schema.profiles.userId, "opponent")).run();

    const result = await queueAllCertificateEmails(db, "t", ADMIN, NOW);

    expect(result).toEqual({ queued: 4, skipped: 0, unprintable: ["गौरव पिल्लई"] });
  });
});

describe("queueCertificateEmail", () => {
  it("refuses a second copy while one is waiting, then allows emailing again once sent", async () => {
    expect(await queueCertificateEmail(db, WINNER, ADMIN, NOW)).toBe("queued");
    expect(await queueCertificateEmail(db, WINNER, ADMIN, NOW + 1)).toBe("waiting");

    db.update(schema.certificateEmails).set({ acceptedAt: NOW + 2 }).run();
    expect(await queueCertificateEmail(db, WINNER, ADMIN, NOW + 3)).toBe("queued");
    expect(rows()).toHaveLength(2);
  });

  it("refuses a certificate the player has not earned", async () => {
    expect(await queueCertificateEmail(db, { userId: "opponent", entryId: "opposition", kind: "winner" }, ADMIN, NOW)).toBe("not-earned");
    expect(rows()).toHaveLength(0);
  });
});

describe("listCertificateEmailStatuses", () => {
  it("reports the latest email of each certificate", async () => {
    await queueCertificateEmail(db, WINNER, ADMIN, NOW);
    db.update(schema.certificateEmails).set({ acceptedAt: NOW + 5 }).run();
    await queueCertificateEmail(db, WINNER, ADMIN, NOW + 10);

    const statuses = listCertificateEmailStatuses(db);

    expect(statuses.get(certificateKey(WINNER))).toEqual({ state: "waiting", at: NOW + 10, lastError: null });
    expect(statuses.size).toBe(1);
  });
});
