/* @vitest-environment node */

import { runScanJob } from "@/server/scan-runtime";
import { analysisCoordinator, scanManager } from "@/server/runtime";

describe("runScanJob", () => {
  beforeEach(() => {
    scanManager.clear();
    return analysisCoordinator.clear();
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
      runLighthouse: async () => ({
        profiles: {
          mobile: {
            score: 61,
            band: "PASSABLE",
            snapshot: {
              performance: 55,
              accessibility: 72,
              bestPractices: 68,
              seo: 70,
              strategy: "mobile",
              source: "local",
            },
          },
          desktop: {
            score: 71,
            band: "PASSABLE",
            snapshot: {
              performance: 69,
              accessibility: 74,
              bestPractices: 70,
              seo: 71,
              strategy: "desktop",
              source: "local",
            },
          },
        },
        qualityScore: 66,
        qualityBand: "PASSABLE",
        raw: {
          mobile: { categories: {} },
          desktop: { categories: {} },
        },
        status: {
          provider: "lighthouse",
          source: "local",
          reason: "Local Lighthouse completed",
          latencyMs: 1200,
        },
      }),
      streamText: async ({ onText }) => {
        const text =
          "Homepage returns HTTP 404. Restore working response before polishing proof and message clarity. tl;dr: fix broken page first.";
        await onText(text);
        return {
          text,
          status: {
            provider: "openai",
            source: "live",
            reason: "OpenAI final synthesis completed",
            model: "gpt-5.4-nano",
            latencyMs: 800,
          },
        };
      },
    });

    const snapshot = scanManager.getScan(started.scanId);

    expect(snapshot?.status).toBe("COMPLETED");
    expect(snapshot?.events.some((event) => event.eventType === "JOB_FAILED")).toBe(false);
    expect(snapshot?.snapshotHash).toBeTruthy();
    expect(snapshot?.siteUnderstanding?.siteType).toBe("OTHER");
    expect(snapshot?.finalPayload?.compliments).toHaveLength(3);
    expect(snapshot?.finalPayload?.priorityFixes).toHaveLength(3);
    expect(snapshot?.finalPayload?.finalText).toContain("HTTP 404");
    expect(snapshot?.findings[0]?.code).toBe("PRIORITY_FIX_1");
    expect(snapshot?.fullRoast).toContain("HTTP 404");
    expect(snapshot?.lighthouseProfiles.mobile?.score).toBe(61);
    expect(snapshot?.lighthouseProfiles.desktop?.score).toBe(71);
  });
});
