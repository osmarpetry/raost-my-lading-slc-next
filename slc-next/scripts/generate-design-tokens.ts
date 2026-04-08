import fs from "node:fs/promises";
import path from "node:path";

import { buildTokenCss } from "../src/design/tokens/css";

async function main() {
  const outputPath = path.resolve(
    process.cwd(),
    "src/design/styles/generated-tokens.css",
  );

  await fs.writeFile(outputPath, buildTokenCss(), "utf8");
}

void main();
