import { expect, test } from "@playwright/test";

test("Real scan on https://google.com completes with scores", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Landing page URL").fill("https://google.com");
  await page.getByRole("button", { name: /start scan/i }).click();

  const log = page.getByRole("log");

  // Wait for scan to complete (generous timeout for real Lighthouse + Ollama)
  await expect(log).toContainText("Scan completed", { timeout: 180_000 });

  // UI should show result summary
  await expect(page.getByText(/Latest run/)).toBeVisible();
  await expect(page.getByText(/Combined/)).toBeVisible();

  // Must not show a failure
  await expect(page.getByText(/SCAN FAILED/)).toHaveCount(0);
});
