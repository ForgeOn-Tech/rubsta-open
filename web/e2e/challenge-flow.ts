import { expect, type Page, type TestInfo } from "@playwright/test";
import { addConfirmedEntrants, addNewerChallengeAttempts } from "./fixtures";
export async function checkChallengeFlow(page: Page, info: TestInfo) {
  await page.goto("/challenges");
  await expect(page.getByText("No scores yet. Be the first to try this challenge.")).toBeVisible();
  await page.goto("/admin/challenges");
  await expect(page).toHaveURL(/\/signin/);
  await page.getByRole("button", { name: "Continue with demo account" }).click();
  await expect(page).toHaveURL(/\/home$/);
  addConfirmedEntrants("OS", ["Challenge Ada", "Challenge Ben"]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/challenges");
  async function record(name: string, score: string) {
    const option = page.getByRole("combobox", { name: "Player", exact: true }).locator("option").filter({ hasText: name });
    await page.getByRole("combobox", { name: "Player", exact: true }).selectOption((await option.getAttribute("value"))!);
    await page.getByLabel(/^Score/).fill(score);
    await page.getByRole("button", { name: "Record attempt", exact: true }).click();
    await expect(page.getByLabel(/^Score/)).toHaveValue("");
    await expect(page.getByRole("status")).toContainText("Attempt saved");
  }
  await record("Challenge Ada", "120.5"); await record("Challenge Ada", "115"); await record("Challenge Ben", "120.5");
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const button = await page.getByRole("button", { name: "Record attempt", exact: true }).boundingBox();
  expect(button!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: info.outputPath("challenge-admin-mobile.png"), fullPage: true });
  await page.getByRole("link", { name: "View public leaderboard" }).click();
  const board = page.getByRole("region", { name: "Leaderboard" });
  await expect(board.getByRole("listitem")).toHaveCount(2);
  await expect(board.getByLabel("Rank 1", { exact: true })).toHaveCount(2);
  await expect(board.getByRole("listitem").filter({ hasText: "Challenge Ada" })).toContainText("2 attempts");
  await page.screenshot({ path: info.outputPath("challenge-public-mobile.png"), fullPage: true });
  addNewerChallengeAttempts();
  await page.goto("/admin/challenges");
  await page.getByRole("link", { name: "Older attempts", exact: true }).click();
  await expect(page).toHaveURL(/kind=serve&page=2/);
  await expect(page.getByRole("link", { name: "Older attempts", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Newer attempts", exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("challenge-older-attempts-mobile.png"), fullPage: true });
  const wrong = page.getByRole("listitem").filter({ hasText: "Challenge Ada" }).filter({ hasText: "120.5 km/h" });
  await wrong.getByText("Correct this attempt", { exact: true }).click();
  await wrong.getByLabel("Reason").fill("Wrong measurement");
  await wrong.getByRole("button", { name: "Void attempt" }).click();
  await expect(wrong).toContainText("Voided: Wrong measurement");
  await page.goto("/challenges");
  await expect(board.getByRole("listitem").first()).toContainText("Challenge Ben");
  await expect(board.getByRole("listitem").nth(1)).toContainText("115.0 km/h");
  await page.goto("/admin/challenges?kind=accuracy"); await record("Challenge Ada", "0");
  await page.goto("/admin/challenges?kind=reaction"); await record("Challenge Ada", "250"); await record("Challenge Ben", "180");
  await page.context().clearCookies();
  await page.goto("/challenges?kind=reaction");
  await expect(board.getByRole("listitem").first()).toContainText("Challenge Ben");
  await expect(board).not.toContainText("demo@rubstaopen.local");
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: info.outputPath("challenge-public-desktop.png"), fullPage: true });
}
