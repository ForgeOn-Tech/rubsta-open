import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("password admin login rejects bad credentials and opens real admin routes", async ({ page }) => {
  const file = process.env.ADMIN_LOGIN_TEST_FILE;
  test.skip(!file, "Requires a privately generated test credential file.");
  const credentials = readFileSync(file!, "utf8");
  const username = credentials.match(/^Username: (.+)$/m)![1];
  const password = credentials.match(/^Password: (.+)$/m)![1];
  await page.goto("/admin-login");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("incorrect-password");
  await page.getByRole("button", { name: "Sign in to admin" }).click();
  await expect(page.locator("form [role=alert]")).toContainText("Unable to sign in");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in to admin" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  await page.goto("/admin/entries");
  await expect(page.getByRole("heading", { name: "Entries", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/signin$/);
  await page.goto("/admin/entries");
  await expect(page).toHaveURL(/\/signin$/);
});
