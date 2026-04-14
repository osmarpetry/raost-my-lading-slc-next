import { defineConfig, devices } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 45_050);

const testDir = defineBddConfig({
  features: "tests/e2e/features/**/*.feature",
  steps: "tests/e2e/steps/**/*.ts",
  featuresRoot: "tests/e2e/features",
  outputDir: "tests/.features-gen",
});

export default defineConfig({
  testDir,
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
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
      `rm -rf .next-test-e2e && rm -f tsconfig.next-test-e2e.json && ` +
      `node scripts/write-isolated-next-tsconfig.mjs tsconfig.next-test-e2e.json && ` +
      `NODE_ENV=test SLC_MOCK_OPENAI=true PORT=${port} SLC_NEXT_DIST_DIR=.next-test-e2e SLC_NEXT_TSCONFIG_PATH=tsconfig.next-test-e2e.json pnpm dev`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
