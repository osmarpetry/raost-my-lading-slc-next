import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";

const { Given, Then, When } = createBdd();

Given("the live scan page is open", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "PASTE URL. GET ROASTED." })).toBeVisible();
});

When("I submit {string}", async ({ page }, url: string) => {
  await page.getByLabel("Landing page URL").fill(url);
  await page.getByRole("button", { name: /start roast/i }).click();
});

When("I refresh while the scan is running", async ({ page }) => {
  await expect(page.getByRole("log")).toContainText("Scan started");
  await page.reload();
});

Then("I should see scan progress in the terminal", async ({ page }) => {
  await expect(page.getByRole("log")).toContainText("Running Lighthouse");
});

Then("I should see a client-side validation error", async ({ page }) => {
  await expect(page.getByRole("log")).toContainText(
    "that does not look like a valid absolute URL",
  );
});

Then("the scan should still recover and complete", async ({ page }) => {
  await expect(page.getByRole("log")).toContainText("Scan completed");
  await expect(page.getByText(/Latest verdict/)).toBeVisible();
});

Then("I should eventually see the final verdict", async ({ page }) => {
  await expect(page.getByRole("log")).toContainText("Scan completed");
  await expect(page.getByText(/Latest verdict/)).toBeVisible();
});

Then("no auth or billing controls should be visible", async ({ page }) => {
  await expect(page.getByRole("button", { name: /sign in/i })).toHaveCount(0);
  await expect(page.getByText(/credits/i)).toHaveCount(0);
  await expect(page.getByText(/checkout/i)).toHaveCount(0);
  await expect(page.getByText(/pricing/i)).toHaveCount(0);
});
