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

  test("the organiser sees the entry and filters by status", async ({ page }) => {
    await signInAsDemo(page);
    await expect(page).toHaveURL(/\/home$/);

    await page.goto("/entries");
    const row = page.getByRole("row", { name: /Demo Player/ });
    await expect(row).toContainText("Men's singles");
    await expect(row).toContainText("Submitted");

    await page.getByRole("link", { name: /^Paid/ }).click();
    await expect(page).toHaveURL(/status=paid/);
    await expect(page.getByText("No paid entries.")).toBeVisible();
  });
});
