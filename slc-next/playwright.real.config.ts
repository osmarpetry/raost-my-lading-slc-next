import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_REAL_PORT ?? 45_060);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 240_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command:
      `rm -rf .next-real-e2e && rm -f tsconfig.real-e2e.json && ` +
      `node scripts/write-isolated-next-tsconfig.mjs tsconfig.real-e2e.json && ` +
      `PORT=${port} SLC_NEXT_DIST_DIR=.next-real-e2e SLC_NEXT_TSCONFIG_PATH=tsconfig.real-e2e.json pnpm dev`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
