import { expect, test } from "@playwright/test";

test("team dashboard requires sign-in and exposes all team sections", async ({ page }) => {
  for (const route of ["/admin/payments", "/admin/operations", "/admin/engagement"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/signin$/);
  }
  await page.getByRole("button", { name: "Continue with demo account" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Team dashboard" })).toBeVisible();
  await page.getByRole("navigation", { name: "Admin", exact: true }).getByRole("link", { name: "Payments", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Payments", exact: true })).toBeVisible();
  await page.getByLabel("Payment source").selectOption("demo");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/source=demo/);
  await expect(page.getByText("No payment records match these filters.")).toBeVisible();
  await page.getByRole("link", { name: "Match operations", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Draw readiness" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Manage draw" })).toHaveCount(4);
  await page.getByRole("link", { name: "Fan engagement", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Activity availability" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Try engagement demo" })).toHaveAttribute("href", "/fan?demo=1#fan-engagement");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/rubsta-team-mobile.png", fullPage: true });
});
