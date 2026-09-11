import os from "node:os";
import path from "node:path";

import { defineConfig } from "@playwright/test";

const PORT = 3100;
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

// A fresh database per run. A reused file keeps the demo user's entries, and
// the next run's submit then fails on the (user, category) unique index.
const DATABASE_PATH =
  process.env.DATABASE_PATH ??
  path.join(os.tmpdir(), `tournament-e2e-${Date.now()}.db`);

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
    command: "npm run dev",
    port: PORT,
    // Never attach to a hand-started server: it has its own env and database.
    reuseExistingServer: false,
    env: {
      DATABASE_PATH,
      DEMO_AUTH: "true",
      AUTH_SECRET: "e2e-test-secret-not-for-production-0123456789",
      AUTH_TRUST_HOST: "true",
    },
  },
});
