import { expect, type Page, type TestInfo } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
export async function checkPlayerCard(page: Page, info: TestInfo) {
 await page.goto("/home");
 await page.getByRole("link", { name: "Share to Instagram" }).click();
 await expect(page).toHaveURL(/\/player-card$/);
 await page.getByText("Sharing options", { exact: true }).click();
 await expect(page.getByRole("heading", { name: "Your card is private" })).toBeVisible();
 await expect(page.getByRole("region", { name: "Tournament results" })).toContainText("Winner");
 await expect(page.getByRole("region", { name: "Match history" }).getByRole("article")).not.toHaveCount(0);
 await page.getByRole("button", { name: "Enable share link" }).click();
 const link = page.getByRole("link", { name: "Open public card" });
 await expect(link).toBeVisible();
 const path = (await link.getAttribute("href"))!;
 await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
 await page.getByRole("button", { name: "Copy link", exact: true }).click();
 await expect(page.getByRole("status")).toHaveText("Link copied.");
 expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(new URL(path, page.url()).href);
 const guest = await page.context().browser()!.newContext({ viewport: { width: 390, height: 844 } });
 await guest.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
 const publicPage = await guest.newPage();
 try {
  const response = await publicPage.goto(new URL(path, page.url()).href);
  await expect(publicPage.getByRole("heading", { name: "Demo Player", exact: true })).toBeVisible();
  const html = await response!.text();
  for (const secret of ["demo@rubstaopen.local", "98765 43210", "2004-05-17"]) expect(html).not.toContain(secret);
  const cert = publicPage.getByRole("region", { name: "Earned certificates" }).locator('a[href$="/winner"]');
  const certUrl = new URL((await cert.getAttribute("href"))!, publicPage.url()).href;
  const pdf = await publicPage.request.get(certUrl);
  expect(pdf.status()).toBe(200);
  expect((await PDFDocument.load(await pdf.body())).getPageCount()).toBe(1);
  expect((await publicPage.request.get(certUrl.replace(/\/[^/]+\/winner$/, "/not-owned/winner"))).status()).toBe(404);
  for (const width of [320, 390, 1280]) {
   await publicPage.setViewportSize({ width, height: 844 });
   expect(await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
   await publicPage.screenshot({ path: info.outputPath(`shared-player-card-${width}.png`), fullPage: true });
  }
  await page.getByRole("button", { name: "Turn off sharing" }).click();
  await expect(page.getByRole("heading", { name: "Your card is private" })).toBeVisible();
  expect((await publicPage.request.get(certUrl)).status()).toBe(404);
  await publicPage.reload();
  await expect(publicPage.getByRole("heading", { name: "Demo Player", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Enable share link" }).click();
  await expect(link).toBeVisible();
  expect(await link.getAttribute("href")).not.toBe(path);
 await expect(page.getByRole("status")).toHaveCount(0);
 await page.getByText("Sharing options", { exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath("player-card-owner-mobile.png"), fullPage: true });
 } finally { await guest.close(); }
}
