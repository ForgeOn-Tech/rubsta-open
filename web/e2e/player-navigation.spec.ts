import { expect, test } from "@playwright/test";

test("mobile player navigation keeps the selected tab visible across layouts", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/signin");
  await page.getByRole("button", { name: "Continue with demo account" }).click();
  await expect(page).toHaveURL(/\/home$/);
  const nav = page.getByRole("navigation", { name: "Tournament", exact: true });
  const labels = await nav.getByRole("link").allTextContents();
  for (const [name, route] of [
    ["Challenges", "/challenges"], ["Profile", "/profile"],
    ["Live", "/live"], ["Leaderboard", "/live/leaderboard"], ["Home", "/home"],
  ]) {
    await nav.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(route + "$"));
    await expect(nav.getByRole("link", { name, exact: true })).toHaveAttribute("aria-current", "page");
    await expect.poll(() => nav.evaluate(element => {
      const active = element.querySelector('[aria-current="page"]')!.getBoundingClientRect();
      const viewport = element.getBoundingClientRect();
      return active.left >= viewport.left - 1 && active.right <= viewport.right + 1;
    })).toBe(true);
    expect(await nav.getByRole("link").allTextContents()).toEqual(labels);
  }
});
