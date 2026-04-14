import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";

const { Given, Then, When } = createBdd();

Given("the live scan page is open", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Real audit. Real roast. Real failure." })).toBeVisible();
});

Given("I switch to a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
});

When("I submit {string}", async ({ page }, url: string) => {
  await page.getByLabel("Landing page URL").fill(url);
  await page.getByRole("button", { name: /start scan/i }).click();
});

When("I refresh while the scan is running", async ({ page }) => {
  await expect(page.getByRole("log")).toContainText("Scan started");
  await page.reload();
});

Then("I should see scan progress in the terminal", async ({ page }) => {
  await expect(page.getByRole("log")).toContainText(/LIGHTHOUSE|OPENAI|Scan started/i);
});

Then("I should see a client-side validation error", async ({ page }) => {
  await expect(page.getByRole("log")).toContainText(
    "that is not valid absolute URL",
  );
});

Then("the terminal should receive focus on mobile", async ({ page }) => {
  await expect(page.getByRole("log")).toBeFocused();
});

Then("the scan should still recover and complete", async ({ page }) => {
  await expect(page.getByRole("log")).toContainText("Scan completed");
  await expect(page.getByText(/Latest run/)).toBeVisible();
});

Then("I should eventually see the final verdict", async ({ page }) => {
  await expect(page.getByRole("log")).toContainText("Scan completed");
  await expect(page.getByText(/Latest run/)).toBeVisible();
});

Then("the scan controls should be re-enabled after completion", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Start Scan" })).toBeEnabled();
  await expect(page.getByRole("button", { name: /Scanning/i })).toHaveCount(0);
  await expect(page.getByLabel("Landing page URL")).toBeEnabled();
});

When("I wait for the scan to complete", async ({ page }) => {
  await expect(page.getByRole("log")).toContainText("Scan completed");
  await expect(page.getByText(/Latest run/)).toBeVisible();
});

When("I reset the scan", async ({ page }) => {
  await page.getByRole("button", { name: "Reset" }).click();
});

Then("the scan UI should return to idle", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Start Scan" })).toBeEnabled();
  await expect(page.getByLabel("Landing page URL")).toBeEnabled();
  await expect(page.getByText("scan idle")).toBeVisible();
  await expect(page.getByText(/Latest run/)).toHaveCount(0);
});

Then("the terminal should be reset to the initial session", async ({ page }) => {
  const log = page.getByRole("log");
  await expect(log).toContainText("truthful scan runtime ready");
  await expect(log).toContainText("slc@truth:~$");
  await expect(log).not.toContainText("Running Lighthouse");
  await expect(log).not.toContainText("Scan completed");
});

Then("no auth or billing controls should be visible", async ({ page }) => {
  await expect(page.getByRole("button", { name: /sign in/i })).toHaveCount(0);
  await expect(page.getByText(/credits/i)).toHaveCount(0);
  await expect(page.getByText(/checkout/i)).toHaveCount(0);
  await expect(page.getByText(/pricing/i)).toHaveCount(0);
});
