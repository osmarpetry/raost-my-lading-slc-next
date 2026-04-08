/* @vitest-environment node */

import { runLighthouseAudit } from "@/server/lighthouse";

describe("runLighthouseAudit", () => {
  it("falls back safely when the audit fails", async () => {
    const result = await runLighthouseAudit("https://example.com", {
      execute: async () => {
        throw new Error("boom");
      },
    });

    expect(result.didFallback).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });

  it("falls back safely on timeout", async () => {
    const result = await runLighthouseAudit("https://example.com", {
      timeoutMs: 10,
      execute: async () =>
        new Promise(() =>
          setTimeout(() => {
            // unreachable on purpose
          }, 100),
        ),
    });

    expect(result.didFallback).toBe(true);
  });
});
