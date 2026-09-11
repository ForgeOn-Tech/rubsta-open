import os from "node:os";
import path from "node:path";

import { defineConfig } from "@playwright/test";

const PORT = 3100;
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

// E2E_TARGET=production runs the suite against `next build` and `next start`.
// The offline reload test needs it: under `next dev`, a scoring page reopened
// with no signal gets every file from the service worker but never hydrates.
const PRODUCTION = process.env.E2E_TARGET === "production";
const PRODUCTION_START_TIMEOUT_MS = 300_000;
const DEV_START_TIMEOUT_MS = 60_000;

// A fresh database per run. A reused file keeps the demo user's entries, and
// the next run's submit then fails on the (user, category) unique index.
// Written back to the environment so test workers, which re-read this config,
// share the path and can add fixtures (see e2e/fixtures.ts).
const DATABASE_PATH =
  process.env.DATABASE_PATH ??
  path.join(os.tmpdir(), `tournament-e2e-${Date.now()}.db`);
process.env.DATABASE_PATH = DATABASE_PATH;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: PRODUCTION ? "npm run build && npm run start" : "npm run dev",
    port: PORT,
    timeout: PRODUCTION ? PRODUCTION_START_TIMEOUT_MS : DEV_START_TIMEOUT_MS,
    // Never attach to a hand-started server: it has its own env and database.
    reuseExistingServer: false,
    env: {
      DATABASE_PATH,
      DEMO_AUTH: "true",
      ADMIN_EMAILS: "demo@rubstaopen.local",
      AUTH_SECRET: "e2e-test-secret-not-for-production-0123456789",
      AUTH_TRUST_HOST: "true",
    },
  },
});
