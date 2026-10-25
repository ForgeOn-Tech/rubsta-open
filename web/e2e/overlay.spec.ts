import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";
import { addConfirmedEntrants, addStreamingCourt } from "./fixtures";

test("OBS shows real court scores on a transparent page and recovers after a lost connection", async ({ page }, info) => {
  await page.goto("/live");
  const court = addStreamingCourt();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`/overlay/${court}`);
  await expect(page.getByText("Waiting for play")).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  await expect(page.locator("nav")).toHaveCount(0);

  addConfirmedEntrants("OS", ["Overlay Player One", "Overlay Player Two"]);
  const database = new Database(process.env.DATABASE_PATH!);
  try {
    const tournament = database.prepare("select id from tournaments limit 1").get() as { id: string };
    const entries = database.prepare("select e.id from entries e join users u on u.id=e.user_id where u.name like 'Overlay Player%' order by u.name").all() as { id: string }[];
    database.prepare("insert into draws (id, tournament_id, category, status, size) values ('overlay-draw', ?, 'OS', 'published', 2)").run(tournament.id);
    database.prepare("insert into matches (id, draw_id, match_number, round_index, round_name, top_slot, bottom_slot, first_server, court, started_at, status) values ('overlay-match', 'overlay-draw', 1, 0, 'Final', ?, ?, 'top', ?, ?, 'in_progress')").run(JSON.stringify({ kind: "entry", entryId: entries[0].id }), JSON.stringify({ kind: "entry", entryId: entries[1].id }), court, Date.now());
    await expect(page.getByRole("row", { name: /Overlay Player One/ })).toContainText("0");
    database.prepare("update matches set events=? where id='overlay-match'").run(JSON.stringify([{ type: "point", side: "top" }]));
    await expect(page.getByRole("row", { name: /Overlay Player One/ }).locator("td").last()).toHaveText("15");
    await expect(page.getByText("Open singles · Final · M1")).toBeVisible();
    await expect(page.getByLabel("Serving", { exact: true })).toHaveCount(1);
    await page.screenshot({ path: info.outputPath("obs-scoreboard.png"), omitBackground: true });

    await page.route(`**/api/overlay/${court}`, route => route.abort());
    await expect(page.getByRole("status")).toContainText("reconnecting");
    await expect(page.getByRole("row", { name: /Overlay Player One/ }).locator("td").last()).toHaveText("15");
    await page.unroute(`**/api/overlay/${court}`);
    await expect(page.getByRole("status")).toHaveCount(0);
    database.prepare("update matches set status='completed' where id='overlay-match'").run();
    await expect(page.getByText("Waiting for play")).toBeVisible();
    const response = await page.request.get(`/api/overlay/${court}`);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect((await page.request.get("/api/overlay/100")).status()).toBe(404);
    expect((await page.goto("/overlay/100"))?.status()).toBe(404);
  } finally { database.close(); }
});
