import { expect, test, type Page } from "@playwright/test";

async function signInAsDemo(page: Page) {
  await page.goto("/signin");
  await page.getByRole("button", { name: "Continue with demo account" }).click();
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
});
