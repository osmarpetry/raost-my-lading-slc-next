import { writeFile } from "node:fs/promises";

const targetPath = process.argv[2];

if (!targetPath) {
  console.error("Expected target tsconfig path.");
  process.exit(1);
}

const config = {
  extends: "./tsconfig.json",
  include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".storybook/**/*.ts"],
  exclude: ["node_modules", "storybook-static", "test-results", "playwright-report"],
};

await writeFile(targetPath, `${JSON.stringify(config, null, 2)}\n`);
