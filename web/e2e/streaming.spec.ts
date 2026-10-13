import { expect, test } from "@playwright/test";
import { addStreamingCourt } from "./fixtures";

test("organisers set up a broadcast and open viewers follow live, replay and off states", async ({ page, browser }, info) => {
  test.setTimeout(120_000);
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  await page.route("https://www.youtube.com/embed/**", route => route.fulfill({ contentType: "text/html", body: "<html><body>Test camera feed</body></html>" }));
  await page.goto("/admin/streaming");
  await expect(page).toHaveURL(/\/signin/);
  await page.getByRole("button", { name: "Continue with demo account" }).click();
  await expect(page).toHaveURL(/\/home$/);
  // Exercise a later court with multiple independent forms on the page.
  addStreamingCourt();
  addStreamingCourt();
  const court = addStreamingCourt();
  await page.goto("/admin/streaming");
  const form = page.getByRole("region", { name: `Court ${court}`, exact: true });
  await form.getByLabel("Broadcast status").selectOption("live");
  await form.getByRole("button", { name: "Save broadcast" }).click();
  await expect(form.getByRole("alert")).toContainText("Add a YouTube");
  await form.getByLabel("YouTube stream link").fill("https://example.com/not-youtube");
  await form.getByRole("button", { name: "Save broadcast" }).click();
  await expect(form.getByRole("alert")).toContainText("Paste a YouTube");
  await form.getByLabel("YouTube stream link").fill("https://youtu.be/abcdefghijk");
  await form.getByLabel("Broadcast status").selectOption("scheduled");
  await form.getByText("Preview video", { exact: true }).click();
  await expect(form.locator("iframe")).toHaveAttribute("src", "https://www.youtube.com/embed/abcdefghijk");
  await expect(form.frameLocator("iframe").getByText("Test camera feed")).toBeVisible();
  await form.getByRole("button", { name: "Save broadcast" }).click();
  await expect(form.getByRole("status")).toContainText("Broadcast saved");
  await page.reload();
  await expect(form.getByLabel("Broadcast status")).toHaveValue("scheduled");
  await expect(form.getByLabel("YouTube stream link")).toHaveValue("https://www.youtube.com/watch?v=abcdefghijk");
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await form.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("streaming-admin-mobile.png"), fullPage: true });
  const guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await guest.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  await guest.route("https://www.youtube.com/embed/**", route => route.fulfill({ contentType: "text/html", body: "<html><body>Test camera feed</body></html>" }));
  const viewer = await guest.newPage();
  try {
    await viewer.goto(new URL(`/live/${court}`, page.url()).href);
    const broadcast = viewer.getByRole("region", { name: "Court broadcast" });
    await expect(broadcast.getByText("Starting soon", { exact: true })).toBeVisible();
    await form.getByLabel("Broadcast status").selectOption("live");
    await form.getByRole("button", { name: "Save broadcast" }).click();
    await expect(broadcast.getByText("Live", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(broadcast.frameLocator("iframe").getByText("Test camera feed")).toBeVisible();
    for (const width of [320, 390, 1280]) {
      await viewer.setViewportSize({ width, height: 844 });
      expect(await viewer.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await viewer.setViewportSize({ width: 390, height: 844 });
    await viewer.screenshot({ path: info.outputPath("streaming-viewer-mobile.png"), fullPage: true });
    await form.getByLabel("Broadcast status").selectOption("ended");
    await form.getByRole("button", { name: "Save broadcast" }).click();
    await expect(broadcast).toContainText("Broadcast ended", { timeout: 20_000 });
    await expect(broadcast.locator("iframe")).toHaveCount(0);
    await form.getByLabel("Replay link (optional)").fill("https://youtu.be/12345678901");
    await form.getByRole("button", { name: "Save broadcast" }).click();
    await expect(broadcast.getByText("Replay", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(broadcast.locator("iframe")).toHaveAttribute("src", "https://www.youtube.com/embed/12345678901");
    await expect(broadcast.getByRole("link", { name: /Watch replay/ })).toHaveAttribute("href", "https://www.youtube.com/watch?v=12345678901");
    await form.getByLabel("Broadcast status").selectOption("off");
    await form.getByRole("button", { name: "Save broadcast" }).click();
    await expect(broadcast.getByText("No broadcast", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(broadcast.locator("iframe")).toHaveCount(0);
    await viewer.goto(new URL("/admin/streaming", page.url()).href);
    await expect(viewer).toHaveURL(/\/signin/);
  } finally { await guest.close(); }
});
