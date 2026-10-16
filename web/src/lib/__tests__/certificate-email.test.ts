// @vitest-environment node
import SQLite from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";
import { SEED_TOURNAMENT } from "@/db/seed";
import { certificateEmailConfig, certificateRequestBody, deliverNextCertificateEmail } from "../certificate-email";

const CONFIG = { apiKey: "fake-test-key" };
const NOW = 1_800_000_000_000;
const PDF = new TextEncoder().encode("%PDF-fake");
const DETAILS = {
  recipient: "meera@example.com",
  playerName: "Meera <Iyer>",
  tournamentName: "Rubsta Open 2026",
  label: "Women's 30+ · Winner's certificate",
  fileName: "rubsta-open-2026-womens-30-winner.pdf",
  pdf: PDF,
};

let sqlite: SQLite.Database;
let db: ReturnType<typeof drizzle<typeof schema>>;

function queue(id: string, createdAt: number) {
  db.insert(schema.certificateEmails).values({
    id, userId: "u", entryId: "e", kind: "winner", recipient: DETAILS.recipient,
    requestBody: certificateRequestBody(DETAILS), queuedBy: "admin@example.com", createdAt,
  }).run();
}
const row = (id: string) => db.select().from(schema.certificateEmails).all().find(item => item.id === id)!;

beforeEach(() => {
  sqlite = new SQLite(":memory:");
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./drizzle" });
  db.insert(schema.users).values({ id: "u", email: DETAILS.recipient }).run();
  db.insert(schema.tournaments).values({ id: "t", ...SEED_TOURNAMENT }).run();
  db.insert(schema.entries).values({ id: "e", userId: "u", tournamentId: "t", category: "W30" }).run();
});
afterEach(() => sqlite.close());

describe("certificateEmailConfig", () => {
  it("needs its own switch and a key, apart from payment emails", () => {
    expect(certificateEmailConfig({})).toBeNull();
    expect(certificateEmailConfig({ RESEND_API_KEY: "fake" })).toBeNull();
    expect(certificateEmailConfig({ PAYMENT_EMAILS_ENABLED: "true", RESEND_API_KEY: "fake" })).toBeNull();
    expect(certificateEmailConfig({ CERTIFICATE_EMAILS_ENABLED: "true" })).toBeNull();
    expect(certificateEmailConfig({ CERTIFICATE_EMAILS_ENABLED: "true", RESEND_API_KEY: " fake " })).toEqual({ apiKey: "fake" });
  });
});

describe("certificateRequestBody", () => {
  it("attaches the PDF and escapes the player's name in the HTML", () => {
    const body = JSON.parse(certificateRequestBody(DETAILS));

    expect(body).toMatchObject({
      from: "Rubsta Open <info@rubstaopen.com>",
      to: ["meera@example.com"],
      subject: "Your Rubsta Open 2026 certificate: Women's 30+ · Winner's certificate",
      attachments: [{ filename: DETAILS.fileName, content: Buffer.from(PDF).toString("base64") }],
    });
    expect(body.text).toContain("Hi Meera <Iyer>,");
    expect(body.html).toContain("Meera &lt;Iyer&gt;");
    expect(body.html).not.toContain("Meera <Iyer>");
  });
});

describe("deliverNextCertificateEmail", () => {
  it("sends once, keyed on the queued row", async () => {
    queue("first", NOW);
    const send = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: "email-1" }));

    expect(await deliverNextCertificateEmail(db, CONFIG, send, NOW)).toBe("accepted");
    expect(await deliverNextCertificateEmail(db, CONFIG, send, NOW)).toBe("idle");

    expect(send).toHaveBeenCalledTimes(1);
    expect((send.mock.calls[0][1]!.headers as Record<string, string>)["Idempotency-Key"]).toBe("certificate/first");
    expect(row("first")).toMatchObject({ acceptedAt: NOW, providerId: "email-1", attempts: 1 });
  });

  it("retries a timeout with the same body and key", async () => {
    queue("first", NOW);
    const send = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(Response.json({ id: "email-1" }));

    expect(await deliverNextCertificateEmail(db, CONFIG, send, NOW)).toBe("retry");
    expect(await deliverNextCertificateEmail(db, CONFIG, send, NOW + 1000)).toBe("idle");
    expect(await deliverNextCertificateEmail(db, CONFIG, send, NOW + 60_001)).toBe("accepted");

    expect(send.mock.calls[0][1]?.body).toEqual(send.mock.calls[1][1]?.body);
    expect(send.mock.calls[0][1]?.headers).toEqual(send.mock.calls[1][1]?.headers);
  });

  it("holds a rejected email for review without saving the response body", async () => {
    queue("first", NOW);
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response("invalid recipient meera@example.com", { status: 422 }));

    expect(await deliverNextCertificateEmail(db, CONFIG, send, NOW)).toBe("review");
    expect(await deliverNextCertificateEmail(db, CONFIG, send, NOW + 3_600_000)).toBe("idle");

    expect(row("first")).toMatchObject({ needsReview: true, lastError: "Resend returned HTTP 422.", acceptedAt: null });
  });

  it("sends an email queued again as a new message with its own key", async () => {
    queue("first", NOW);
    queue("again", NOW + 1);
    const send = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: "email" }));

    await deliverNextCertificateEmail(db, CONFIG, send, NOW + 2);
    await deliverNextCertificateEmail(db, CONFIG, send, NOW + 2);

    expect(send.mock.calls.map(call => (call[1]!.headers as Record<string, string>)["Idempotency-Key"]))
      .toEqual(["certificate/first", "certificate/again"]);
  });

  it("stops retrying after Resend's idempotency window and asks for review", async () => {
    queue("first", NOW);
    const send = vi.fn<typeof fetch>().mockRejectedValue(new Error("timeout"));
    await deliverNextCertificateEmail(db, CONFIG, send, NOW);

    expect(await deliverNextCertificateEmail(db, CONFIG, send, NOW + 23 * 60 * 60 * 1000)).toBe("review");

    expect(send).toHaveBeenCalledTimes(1);
    expect(row("first").needsReview).toBe(true);
  });
});
