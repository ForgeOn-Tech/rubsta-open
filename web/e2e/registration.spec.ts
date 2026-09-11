import { expect, test, type Page } from "@playwright/test";

import { addConfirmedEntrants, addDoublesInvitation } from "./fixtures";

async function signInAsDemo(page: Page) {
  await page.goto("/signin");
  await page.getByRole("button", { name: "Continue with demo account" }).click();
  // Wait for the redirect: navigating away earlier cancels sign-in before the session cookie is set.
  await expect(page).toHaveURL(/\/home$/);
}

// Serial: the organiser test reads the entry the player test creates.
test.describe.serial("registration", () => {
  test("a new player goes from home to a profile and a first entry", async ({ page }) => {
    const main = page.getByRole("main");
    await signInAsDemo(page);

    await expect(page).toHaveURL(/\/home$/);
    await expect(main.getByRole("heading", { name: "Create your player profile" })).toBeVisible();
    await main.getByRole("link", { name: "Create profile" }).click();

    await expect(page).toHaveURL(/\/profile$/);
    await page.getByLabel("Full name").fill("Demo Player");
    await page.getByLabel("Date of birth").fill("2004-05-17");
    await page.getByLabel("Gender").selectOption("male");
    await page.getByLabel("Mobile").fill("+91 98765 43210");
    await page.getByRole("button", { name: "Create profile" }).click();

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole("heading", { name: "Welcome, Demo" })).toBeVisible();
    await main.getByRole("link", { name: "Enter an event" }).click();

    await expect(page).toHaveURL(/\/register$/);
    await page.getByRole("radio", { name: "Men's singles", exact: true }).check();
    await page.getByRole("button", { name: "Submit entry" }).click();

    await expect(page.getByRole("heading", { name: "Entry received" })).toBeVisible();
    await expect(page.getByText("Men's singles · Main draw")).toBeVisible();

    await page.getByRole("link", { name: "Back to home" }).click();
    await expect(page).toHaveURL(/\/home$/);
    const entries = page.getByRole("region", { name: "Your entries" });
    await expect(entries).toContainText("Men's singles");
    await expect(entries).toContainText("Submitted");
    await expect(main.getByRole("heading", { name: "Enter another event" })).toBeVisible();

    await page.goto("/register");
    await expect(page.getByRole("radio", { name: "Men's singles", exact: true })).toBeDisabled();
  });

  test("an admin sees the entry in the overview and the entries table", async ({ page }) => {
    await signInAsDemo(page);
    await expect(page).toHaveURL(/\/home$/);

    await page.getByRole("link", { name: "Admin" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    const events = page.getByRole("region", { name: "Entries by event" });
    await expect(events.getByRole("row", { name: /Men's singles/ })).toContainText("1");

    // The old organiser URL redirects into the admin interface.
    await page.goto("/entries");
    await expect(page).toHaveURL(/\/admin\/entries$/);
    const row = page.getByRole("row", { name: /Demo Player/ });
    await expect(row).toContainText("Men's singles");
    await expect(row).toContainText("Submitted");

    const statusFilter = page.getByRole("navigation", { name: "Filter by status" });
    await statusFilter.getByRole("link", { name: /^Paid/ }).click();
    await expect(page).toHaveURL(/\/admin\/entries\?status=paid$/);
    await expect(page.getByText("No paid entries.")).toBeVisible();
    await statusFilter.getByRole("link", { name: /^All/ }).click();

    await row.getByRole("button", { name: /^Confirm/ }).click();
    await expect(row).toContainText("Confirmed");
    await row.getByRole("button", { name: /^Mark paid/ }).click();
    await expect(row).toContainText("Paid");

    await row.getByRole("link", { name: "Demo Player" }).click();
    await expect(page.getByRole("heading", { name: "Demo Player" })).toBeVisible();
    const entry = page.getByRole("region", { name: "Entry" });
    await expect(entry).toContainText("manual");

    const csv = await page.request.get("/admin/entries/export?status=paid");
    expect(csv.headers()["content-type"]).toContain("text/csv");
    expect(csv.headers()["content-disposition"]).toContain('filename="rubsta-open-2026-entries.csv"');
    const body = await csv.text();
    expect(body).toContain("Payment reference");
    expect(body).toContain("Demo Player");
    expect(body).toContain("Men's singles");

    await page.goto("/admin/players?q=demo");
    await expect(page.getByRole("row", { name: /Demo Player/ })).toContainText("Men's singles");
    await page.getByLabel("Search players").fill("nobody-here");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText("No players match")).toBeVisible();

    await page.goto("/admin/settings");
    await page.getByLabel("Start date").fill("2026-09-25");
    await page.getByLabel("End date").fill("2026-09-27");
    await page.getByLabel("Venue").fill("Deccan Gymkhana, Pune");
    await page.getByLabel("Schedule confirmed").check();
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByRole("status")).toHaveText("Settings saved.");

    await page.goto("/home");
    const tournament = page.getByRole("region", { name: "Rubsta Open 2026" });
    await expect(tournament).toContainText("Deccan Gymkhana, Pune");
    await expect(tournament).toContainText(/25–27 Sept? 2026/);
    await expect(page.getByText(/provisional until the organisers confirm/)).toHaveCount(0);
  });

  test("an admin seeds, generates and publishes a draw", async ({ page }) => {
    // The demo player's paid entry plus four confirmed players: a draw of 8 with 3 byes.
    addConfirmedEntrants("MS", ["Arjun Mehta", "Kabir Rao", "Rohan Das", "Vikram Shah"]);
    await signInAsDemo(page);

    await page.goto("/admin/draws");
    const menSingles = page.getByRole("row", { name: /Men's singles/ });
    await expect(menSingles).toContainText("8 lines");
    await menSingles.getByRole("link", { name: "Men's singles" }).click();
    await expect(page).toHaveURL(/\/admin\/draws\/MS$/);

    await page.getByLabel("Seed for Demo Player").fill("1");
    await page.getByLabel("Seed for Arjun Mehta").fill("2");
    await page.getByRole("button", { name: "Save seeds" }).click();
    await expect(page.getByText("Seeds saved.")).toBeVisible();

    await page.getByRole("button", { name: "Generate draw" }).click();
    const draw = page.getByRole("region", { name: "Draw", exact: true });
    await expect(draw.getByText("Bye")).toHaveCount(3);
    await expect(draw.getByRole("listitem", { name: "Match 1", exact: true })).toContainText(
      "Demo Player",
    );
    await expect(draw.getByRole("listitem", { name: "Match 4", exact: true })).toContainText(
      "Arjun Mehta",
    );

    await page.getByRole("button", { name: "Publish draw" }).click();
    await expect(page.getByRole("button", { name: "Back to draft" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate again" })).toHaveCount(0);
    await expect(page.getByLabel("Seed for Demo Player")).toBeDisabled();

    // The entries table warns that these entries sit in a published draw.
    await page.goto("/admin/entries?category=MS");
    await expect(page.getByRole("row", { name: /Demo Player/ })).toContainText(
      "In the published draw",
    );
  });

  test("an admin builds, publishes and prints the order of play", async ({ page }) => {
    // The tournament runs 25–27 Sept (set above), so the page opens on its first day.
    await signInAsDemo(page);
    await page.goto("/admin/settings");
    const courts = page.getByRole("region", { name: "Courts" });
    await courts.getByLabel("Name").last().fill("Centre");
    await courts.getByLabel("Surface").last().fill("Hard");
    await courts.getByRole("button", { name: "Add court" }).click();
    await expect(courts.getByRole("group", { name: "Court 1" })).toBeVisible();
    await courts.getByLabel("Name").last().fill("Show court");
    await courts.getByRole("button", { name: "Add court" }).click();
    await expect(courts.getByRole("group", { name: "Court 2" })).toBeVisible();

    await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Order of play" }).click();
    await expect(page).toHaveURL(/\/admin\/order-of-play$/);
    await expect(page.getByText(/Rubsta Open 2026 · Fri 25 Sept?/)).toBeVisible();

    const addMatch = page.getByRole("region", { name: /Add a match/ });
    await addMatch.getByLabel("Match").selectOption({ index: 1 });
    await addMatch.getByLabel("Court").selectOption("1");
    await addMatch.getByLabel("Umpire").selectOption("demo@rubstaopen.local");
    await addMatch.getByLabel("Time").fill("11:00");
    await addMatch.getByRole("button", { name: "Add match" }).click();
    const courtOne = page.getByRole("region", { name: "Court 1", exact: true });
    await expect(courtOne).toContainText("11:00");
    await expect(courtOne).toContainText("Umpire: Demo Player");

    const addSession = page.getByRole("region", { name: /Add a session/ });
    await addSession.getByLabel("Court").selectOption("2");
    await addSession.getByLabel("Title").fill("Serve Speed Challenge");
    await addSession.getByLabel("Starts").fill("12:00");
    await addSession.getByLabel("Ends").fill("14:00");
    await addSession.getByRole("button", { name: "Add session" }).click();
    await expect(page.getByRole("region", { name: "Court 2", exact: true })).toContainText("12:00–14:00");

    await expect(page.getByText("Not published")).toBeVisible();
    await page.getByRole("button", { name: "Publish schedule" }).click();
    await expect(page.getByRole("button", { name: "Published" })).toBeDisabled();

    // A later edit waits for the next publish.
    await courtOne.locator("summary", { hasText: "Edit" }).click();
    await courtOne.getByLabel("When").selectOption("notBefore");
    await courtOne.getByLabel("Time").fill("15:30");
    await courtOne.getByRole("button", { name: "Save" }).click();
    await expect(courtOne).toContainText("Not before 15:30");
    await expect(page.getByText("Unpublished changes")).toBeVisible();
    await page.getByRole("button", { name: "Publish changes" }).click();
    await expect(page.getByRole("button", { name: "Published" })).toBeDisabled();

    await page.getByRole("link", { name: "Print sheet" }).click();
    await expect(page).toHaveURL(/\/admin\/order-of-play\/print\?day=2026-09-25$/);
    await expect(page.getByRole("heading", { name: /Order of play · Fri 25 Sept?/ })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Admin" })).toHaveCount(0);
    const sheetCourt = page.getByRole("region", { name: /Court 1/ });
    await expect(sheetCourt).toContainText("Not before 15:30");
    await expect(sheetCourt).toContainText("Demo Player");

    // The umpire sees the match first on the scoring list, and the published day.
    await page.goto("/score");
    const yours = page.getByRole("region", { name: /Your matches/ });
    await expect(yours).toContainText(/Fri 25 Sept? · Court 1 · Not before 15:30/);
    await page.getByRole("link", { name: "Order of play" }).click();
    await expect(page).toHaveURL(/\/score\/schedule\/2026-09-25$/);
    await expect(page.getByRole("region", { name: "Court 1" })).toContainText("Umpire: You");
    await expect(page.getByRole("region", { name: "Court 2" })).toContainText("Serve Speed Challenge");
  });

  test("an umpire keeps scoring through a dropped connection", async ({ page, context }) => {
    // Scores a match from the draw published above. The demo account is an admin, so it can score.
    await signInAsDemo(page);
    await page.getByRole("link", { name: "Scoring", exact: true }).click();
    await expect(page).toHaveURL(/\/score$/);

    await page.getByRole("region", { name: /Ready to start/ }).getByRole("link").first().click();
    await expect(page).toHaveURL(/\/score\/[^/]+$/);
    await page.getByRole("radio").first().check();
    // The courts added above make the court a choice.
    await page.getByRole("combobox", { name: /^Court/ }).selectOption("2");
    await page.getByRole("button", { name: "Start match" }).click();
    const sync = page.getByRole("status");
    await expect(sync).toHaveText("Saved");

    const score = page.getByRole("table", { name: "Score" });
    const topPoint = page.getByRole("button", { name: /^Point — / }).first();
    await context.setOffline(true);
    await topPoint.click();
    await topPoint.click();
    await expect(score).toContainText("30");
    await expect(sync).toContainText("Offline");

    await context.setOffline(false);
    await expect(sync).toHaveText("Saved");

    // The server kept both points: they survive a reload and show on the list.
    await page.reload();
    await expect(score).toContainText("30");
    await page.getByRole("link", { name: "All matches" }).click();
    await expect(page.getByRole("region", { name: /In progress/ })).toContainText("Court 2");

    // Admin results show the match live, with statistics from its two points.
    await page.goto("/admin/results");
    const menSingles = page.getByRole("region", { name: "Men's singles" });
    await menSingles.getByRole("row").filter({ hasText: "Live" }).getByRole("link").click();
    await expect(page).toHaveURL(/\/admin\/results\/[^/]+$/);
    const stats = page.getByRole("table", { name: "Match statistics" });
    await expect(stats.getByRole("row", { name: /Points won/ })).toHaveText(/^2\s*Points won\s*0$/);
  });

  test("a scoring page opened once still loads with no signal", async ({ page, context }) => {
    test.skip(
      process.env.E2E_TARGET !== "production",
      "Under next dev a page reopened with no signal never hydrates. Run npm run test:e2e:production.",
    );
    // Opens the match scored above through a link, in a browser that has never run the worker.
    await signInAsDemo(page);
    await page.goto("/score");
    await page.getByRole("region", { name: /In progress/ }).getByRole("link").first().click();
    await expect(page).toHaveURL(/\/score\/[^/]+$/);
    const matchUrl = page.url();
    const score = page.getByRole("table", { name: "Score" });
    await expect(score).toContainText("30");

    // Wait for the worker to keep both pages before the signal goes.
    const kept = (url: string) =>
      page.evaluate(
        (key) => caches.match(key, { ignoreVary: true }).then((response) => response !== undefined),
        url,
      );
    await expect.poll(() => kept(new URL("/score", matchUrl).toString())).toBe(true);
    await expect.poll(() => kept(matchUrl)).toBe(true);

    // No online reload first: the page must come from what the worker kept.
    await context.setOffline(true);
    await page.reload();
    await expect(score).toContainText("30");
    await page.getByRole("button", { name: /^Point — / }).first().click();
    await expect(score).toContainText("40");
    await expect(page.getByRole("status")).toContainText("Offline");

    // Links between the list and the match still work.
    await page.getByRole("link", { name: "All matches" }).click();
    await expect(page.getByText(/^No connection/)).toBeVisible();
    await page.getByRole("region", { name: /In progress/ }).getByRole("link").first().click();
    await expect(score).toContainText("40");

    // A page never opened on this phone says why it cannot load.
    await page.goto(new URL("/score/never-opened", matchUrl).toString());
    await expect(page.getByRole("heading", { name: "No connection" })).toBeVisible();

    // Back online, the point scored offline reaches the server.
    await context.setOffline(false);
    await page.goto(matchUrl);
    await expect(score).toContainText("40");
    await expect(page.getByRole("status")).toHaveText("Saved");
  });

  test("a player accepts a doubles invitation, then waits on a partner of their own", async ({ page }) => {
    // The demo account is the only browser identity, so another player invites it.
    addDoublesInvitation("MD", "Riya Singh", "demo@rubstaopen.local");
    await signInAsDemo(page);

    await page.getByRole("region", { name: "Partner invitations" }).getByRole("link", { name: /Men's doubles/ }).click();
    await expect(page).toHaveURL(/\/partner\/[^/]+$/);
    await expect(
      page.getByRole("heading", { name: "Riya Singh wants you as their Men's doubles partner" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Accept" }).click();
    await expect(page.getByText("You are playing Men's doubles with Riya Singh.")).toBeVisible();

    await page.getByRole("link", { name: "Back to home" }).click();
    await expect(page.getByRole("region", { name: "Partner invitations" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Your entries" })).toContainText(
      "With Riya Singh · You joined as partner",
    );

    // The accepted event is taken; a new doubles entry waits for its own partner.
    await page.goto("/register");
    await expect(page.getByRole("radio", { name: "Men's doubles", exact: true })).toBeDisabled();
    await page.getByRole("radio", { name: "Women's doubles", exact: true }).check();
    await page.getByLabel("Partner name").fill("Asha Rao");
    await page.getByLabel("Partner email").fill("asha@example.com");
    await page.getByRole("button", { name: "Submit entry" }).click();
    await expect(page.getByRole("heading", { name: "Your partner needs to accept" })).toBeVisible();
    await expect(page.getByLabel("Link for your partner")).toHaveValue(/\/partner\/[^/]+$/);
  });
});
