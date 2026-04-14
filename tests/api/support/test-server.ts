/* @vitest-environment node */

import { rm, writeFile } from "node:fs/promises";

import { createAppServer } from "@/server/bootstrap";
import { scanManager } from "@/server/runtime";

export async function startTestServer() {
  scanManager.clear();
  const distDir = `.next-test-api-${process.pid}`;
  const tsconfigPath = `tsconfig.next-test-api-${process.pid}.json`;
  const previousDistDir = process.env.SLC_NEXT_DIST_DIR;
  const previousTsconfigPath = process.env.SLC_NEXT_TSCONFIG_PATH;
  process.env.SLC_NEXT_DIST_DIR = distDir;
  process.env.SLC_NEXT_TSCONFIG_PATH = tsconfigPath;
  await writeFile(
    tsconfigPath,
    `${JSON.stringify(
      {
        extends: "./tsconfig.json",
        include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".storybook/**/*.ts"],
        exclude: ["node_modules", "storybook-static", "test-results", "playwright-report"],
      },
      null,
      2,
    )}\n`,
  );

  const appServer = await createAppServer({
    dev: true,
    dir: process.cwd(),
    hostname: "127.0.0.1",
    port: 0,
    distDir,
  });

  const port = await appServer.start();

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: async () => {
      await appServer.close();
      await Promise.all([
        rm(distDir, { recursive: true, force: true }),
        rm(tsconfigPath, { force: true }),
      ]);

      if (previousDistDir === undefined) {
        delete process.env.SLC_NEXT_DIST_DIR;
      } else {
        process.env.SLC_NEXT_DIST_DIR = previousDistDir;
      }

      if (previousTsconfigPath === undefined) {
        delete process.env.SLC_NEXT_TSCONFIG_PATH;
      } else {
        process.env.SLC_NEXT_TSCONFIG_PATH = previousTsconfigPath;
      }
    },
  };
}
