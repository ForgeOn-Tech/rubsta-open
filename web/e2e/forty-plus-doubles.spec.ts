import { expect, test } from "@playwright/test";

test.use({ channel: "chrome" });

test("40+ doubles registers a team for 3000 rupees", async ({ page }) => {
  await page.goto("/signin");
  await page.getByRole("button", { name: "Continue with demo account" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Forty Doubles Test");
  await page.getByLabel("Date of birth").fill("1980-05-17");
  await page.getByLabel("Gender").selectOption("male");
  await page.getByLabel("Mobile").fill("+91 98765 43210");
  await page.getByLabel("Choose your event").selectOption("D40");
  await expect(page.locator('option[value="D40"]')).toHaveText("40+ doubles · ₹3,000");
  await expect(page.getByLabel("Partner name")).toHaveAttribute("required", "");
  await expect(page.getByLabel("Partner email")).toHaveAttribute("required", "");
  await page.getByLabel("Partner name").fill("Doubles Partner Test");
  await page.getByLabel("Partner email").fill("forty-partner@example.com");
  await page.getByRole("button", { name: "Create profile & enter" }).click();
  await expect(page).toHaveURL(/\/register\/[^/]+$/);
  await expect(page.getByText("40+ doubles · Main draw")).toBeVisible();
  await page.reload();
  await expect(page.getByText("40+ doubles · Main draw")).toBeVisible();
  await page.screenshot({ path: "/tmp/rubsta-d40-entry.png", fullPage: true });
});
