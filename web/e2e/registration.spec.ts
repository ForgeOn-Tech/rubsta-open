import { expect, test, type Page } from "@playwright/test";

async function signInAsDemo(page: Page) {
  await page.goto("/signin");
  await page.getByRole("button", { name: "Continue with demo account" }).click();
}

// Serial: the organiser test reads the entry the player test creates.
test.describe.serial("registration", () => {
  test("a player creates a profile and enters men's singles", async ({ page }) => {
    await signInAsDemo(page);

    await expect(page).toHaveURL(/\/profile$/);
    await page.getByLabel("Full name").fill("Demo Player");
    await page.getByLabel("Date of birth").fill("2004-05-17");
    await page.getByLabel("Gender").selectOption("male");
    await page.getByLabel("Mobile").fill("+91 98765 43210");
    await page.getByRole("button", { name: "Create profile" }).click();

    await expect(page).toHaveURL(/\/register$/);
    await page.getByRole("radio", { name: "Men's singles", exact: true }).check();
    await page.getByRole("button", { name: "Submit entry" }).click();

    await expect(page.getByRole("heading", { name: "Entry received" })).toBeVisible();
    await expect(page.getByText("Men's singles · Main draw")).toBeVisible();

    await page.getByRole("link", { name: "Back to entry" }).click();
    await expect(page.getByRole("radio", { name: "Men's singles", exact: true })).toBeDisabled();
  });

  test("the organiser sees the entry and filters by status", async ({ page }) => {
    await signInAsDemo(page);
    await expect(page).toHaveURL(/\/register$/);

    await page.goto("/entries");
    const row = page.getByRole("row", { name: /Demo Player/ });
    await expect(row).toContainText("Men's singles");
    await expect(row).toContainText("Submitted");

    await page.getByRole("link", { name: /^Paid/ }).click();
    await expect(page).toHaveURL(/status=paid/);
    await expect(page.getByText("No paid entries.")).toBeVisible();
  });
});
