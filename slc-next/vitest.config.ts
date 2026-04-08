import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    setupFiles: ["./tests/unit/setup/vitest.setup.ts"],
    environment: "jsdom",
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/api/**/*.test.ts"],
  },
});
