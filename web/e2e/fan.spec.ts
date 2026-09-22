import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

test("fans can browse published draws and keep favourites without signing in", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/fan");
  await expect(page.getByRole("heading", { name: /A front-row seat/ })).toBeVisible();
  const db = new Database(process.env.DATABASE_PATH!);
  const drawId = randomUUID();
  try {
    const { id } = db.prepare("select id from tournaments limit 1").get() as { id: string };
    const userId = randomUUID();
    const entryId = randomUUID();
    db.prepare("insert into users (id, name, email) values (?, ?, ?)").run(userId, "Fan Test Player", `${userId}@private.test`);
    db.prepare("insert into entries (id, user_id, tournament_id, category, status) values (?, ?, ?, 'WD', 'confirmed')").run(entryId, userId, id);
    db.prepare("insert into draws (id, tournament_id, category, status, size) values (?, ?, 'WD', 'published', 2)").run(drawId, id);
    db.prepare("insert into draw_slots (id, draw_id, position, entry_id) values (?, ?, 1, ?)").run(randomUUID(), drawId, entryId);
    db.prepare("insert into draw_slots (id, draw_id, position) values (?, ?, 2)").run(randomUUID(), drawId);
    await page.getByRole("button", { name: "Refresh draws" }).click();
    await expect(page.getByText("Fan Test Player", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Players & teams" }).click();
    await page.getByRole("button", { name: "Follow Fan Test Player", exact: true }).click();
    await page.reload();
    await page.getByRole("button", { name: "My favourites (1)" }).click();
    await expect(page.getByRole("heading", { name: "Fan Test Player" })).toBeVisible();
    await page.getByRole("searchbox").fill("missing player");
    await expect(page.getByRole("heading", { name: "No matching players." })).toBeVisible();
    await page.getByRole("searchbox").fill("");
    await page.getByRole("button", { name: "Unfollow Fan Test Player" }).click();
    await expect(page.getByRole("heading", { name: "Make it your tournament." })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: "/tmp/rubsta-fan-mobile.png", fullPage: true });
    db.prepare("update draws set status = 'draft' where id = ?").run(drawId);
    await page.reload();
    await expect(page.getByText("Fan Test Player", { exact: true })).toHaveCount(0);
  } finally {
    db.prepare("delete from draw_slots where draw_id = ?").run(drawId);
    db.prepare("delete from draws where id = ?").run(drawId);
    db.close();
  }
});
