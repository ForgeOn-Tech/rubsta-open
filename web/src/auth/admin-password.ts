import { scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(scrypt);
export const PASSWORD_ADMIN_EMAIL = "admin-password@rubstaopen.invalid";
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
// One bounded bucket for this single account, shared across module reloads.
const globalState = globalThis as unknown as { adminLoginAttempts?: { since: number; count: number } };

export function adminPasswordConfigured() {
  return Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD_VERSION
    && /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(process.env.ADMIN_PASSWORD_HASH ?? "")
    && (process.env.ADMIN_EMAILS ?? "").split(",").some((email) => email.trim().toLowerCase() === PASSWORD_ADMIN_EMAIL));
}

export async function verifyAdminPassword(username: unknown, password: unknown): Promise<boolean> {
  if (!adminPasswordConfigured()) return false;
  const now = Date.now();
  const bucket = globalState.adminLoginAttempts;
  if (!bucket || now - bucket.since >= WINDOW_MS) globalState.adminLoginAttempts = { since: now, count: 0 };
  const attempts = globalState.adminLoginAttempts!;
  if (attempts.count >= MAX_ATTEMPTS) return false;
  attempts.count += 1;
  if (typeof username !== "string" || typeof password !== "string" || username.length > 100 || password.length > 256 || !password) return false;
  const [, salt, expected] = process.env.ADMIN_PASSWORD_HASH!.split(":");
  const actual = await derive(password, salt, 64) as Buffer;
  const passwordMatches = timingSafeEqual(actual, Buffer.from(expected, "hex"));
  if (!passwordMatches || username.trim() !== process.env.ADMIN_USERNAME) return false;
  attempts.count = 0;
  return true;
}
