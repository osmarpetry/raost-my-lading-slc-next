/* @vitest-environment node */

import { runScanJob } from "@/server/scan-runtime";
import { scanManager } from "@/server/runtime";

describe("runScanJob", () => {
  beforeEach(() => {
    scanManager.clear();
  });

  it("completes when the homepage responds with a reachable HTTP error", async () => {
    const started = scanManager.startScan({
      url: "https://example.com/missing",
      normalizedUrl: "https://example.com/missing",
    });

    const fetchImpl: typeof fetch = async (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url === "https://example.com/missing") {
        return new Response('{"detail":"Not Found"}', {
          status: 404,
          headers: {
            "content-type": "application/json",
          },
        });
      }

      throw new Error(`Unexpected fetch to ${url}`);
    };

    await runScanJob(started.scanId, {
      fetchImpl,
      sleepMs: async <T = void>(_delay?: number, value?: T) => value as T,
      runLighthouse: async () => ({
        lighthouse: {
          performance: 55,
          accessibility: 72,
          bestPractices: 68,
          seo: 70,
        },
        score: 66,
        band: "PASSABLE",
        didFallback: false,
      }),
      streamText: async ({ fallback, onText }) => {
        await onText(fallback);
        return fallback;
      },
    });

    const snapshot = scanManager.getScan(started.scanId);

    expect(snapshot?.status).toBe("COMPLETED");
    expect(snapshot?.events.some((event) => event.eventType === "JOB_FAILED")).toBe(false);
    expect(snapshot?.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "HOMEPAGE_STATUS",
          title: "Homepage responds with HTTP 404",
        }),
      ]),
    );
    expect(snapshot?.fullRoast).toContain("HTTP 404");
  });
});
