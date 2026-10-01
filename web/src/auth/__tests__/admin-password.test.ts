// @vitest-environment node
import { scryptSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminPasswordConfigured, PASSWORD_ADMIN_EMAIL, verifyAdminPassword } from "../admin-password";
import { authConfig } from "../config";

const password = "test-password-not-for-production";
beforeEach(() => {
  const salt = "ab".repeat(16);
  vi.stubEnv("ADMIN_USERNAME", "test-admin");
  vi.stubEnv("ADMIN_PASSWORD_HASH", `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`);
  vi.stubEnv("ADMIN_PASSWORD_VERSION", "test-version");
  vi.stubEnv("ADMIN_EMAILS", PASSWORD_ADMIN_EMAIL);
  delete (globalThis as unknown as { adminLoginAttempts?: unknown }).adminLoginAttempts;
});
afterEach(() => vi.unstubAllEnvs());
describe("admin password authentication", () => {
  it("accepts only the configured credentials", async () => {
    expect(await verifyAdminPassword("test-admin", "wrong")).toBe(false);
    expect(await verifyAdminPassword("someone-else", password)).toBe(false);
    expect(await verifyAdminPassword("test-admin", password)).toBe(true);
  });
  it("requires an explicitly authorised admin identity", async () => {
    vi.stubEnv("ADMIN_EMAILS", "someone@example.com");
    expect(adminPasswordConfigured()).toBe(false);
    expect(await verifyAdminPassword("test-admin", password)).toBe(false);
  });
  it("limits repeated attempts and allows retry after the window", async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    try {
      for (let attempt = 0; attempt < 8; attempt++) await verifyAdminPassword("test-admin", "wrong");
      expect(await verifyAdminPassword("test-admin", password)).toBe(false);
      clock.mockReturnValue(now + 600_001);
      expect(await verifyAdminPassword("test-admin", password)).toBe(true);
    } finally { clock.mockRestore(); }
  }, 15000);
  it("revokes password sessions after version rotation or eight hours", async () => {
    const jwt = authConfig.callbacks!.jwt!;
    // Session refresh has no user argument; Auth.js types also cover initial sign-in.
    const args = { token: { adminPasswordVersion: "old-version", adminPasswordExpires: Date.now() + 1000 } } as unknown as Parameters<typeof jwt>[0];
    expect(await jwt(args)).toBeNull();
    args.token.adminPasswordVersion = "test-version";
    args.token.adminPasswordExpires = Date.now() - 1;
    expect(await jwt(args)).toBeNull();
    args.token = { id: "google-player" };
    expect(await jwt(args)).toEqual({ id: "google-player" });
  });
});
