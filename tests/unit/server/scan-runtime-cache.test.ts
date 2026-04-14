/* @vitest-environment node */

import { runScanJob } from "@/server/scan-runtime";
import { analysisCoordinator, scanManager } from "@/server/runtime";
import { scanRunStore } from "@/server/storage";
import type { LighthouseRunResult } from "@/server/lighthouse";

function createMockFetch(html: string): typeof fetch {
  return async () => {
    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  };
}

function createMockLighthouse(): (targetUrl: string) => Promise<LighthouseRunResult> {
  return async () => {
    const mobileScore = 61;
    const desktopScore = 71;
    const qualityScore = Math.round((mobileScore + desktopScore) / 2);

    return {
      profiles: {
        mobile: {
          score: mobileScore,
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
          score: desktopScore,
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
      qualityScore,
      qualityBand: "PASSABLE",
      raw: { mobile: { categories: {} }, desktop: { categories: {} } },
      status: {
        provider: "lighthouse",
        source: "local",
        reason: "Local Lighthouse completed",
        latencyMs: 50,
      },
    };
  };
}

function createMockStreamText(text: string): typeof import("@/server/providers/openai/client").streamOpenAiText {
  return async ({ onText }) => {
    await onText(text);
    return {
      text,
      status: {
        provider: "openai" as const,
        source: "live" as const,
        reason: "Mock OpenAI response",
        model: "gpt-5.4-nano",
        latencyMs: 10,
      },
    };
  };
}

describe("runScanJob caching behavior", () => {
  beforeEach(() => {
    scanManager.clear();
    return analysisCoordinator.clear();
  });

  it("reuses exact snapshot cache on second run (instant completion)", async () => {
    const html = `
      <html>
        <head><title>Workflow SaaS</title></head>
        <body>
          <h1>Transform Your Workflow</h1>
          <section>Trusted by 10,000+ teams worldwide.</section>
          <section>Start your free trial today.</section>
        </body>
      </html>
    `;

    // First run
    const first = scanManager.startScan({
      url: "https://example.com",
      normalizedUrl: "https://example.com/",
    });

    await runScanJob(first.scanId, {
      fetchImpl: createMockFetch(html),
      runLighthouse: createMockLighthouse(),
      streamText: createMockStreamText("First run roast. tl;dr: first."),
    });

    const firstSnapshot = scanManager.getScan(first.scanId);
    expect(firstSnapshot?.status).toBe("COMPLETED");
    expect(firstSnapshot?.cacheState).toBe("fresh");

    // Second run with identical HTML
    const second = scanManager.startScan({
      url: "https://example.com",
      normalizedUrl: "https://example.com/",
    });

    await runScanJob(second.scanId, {
      fetchImpl: createMockFetch(html),
      runLighthouse: createMockLighthouse(),
      streamText: createMockStreamText("Second run roast. tl;dr: second."),
    });

    const secondSnapshot = scanManager.getScan(second.scanId);
    expect(secondSnapshot?.status).toBe("COMPLETED");
    expect(secondSnapshot?.cacheState).toBe("cached");
    // Should reuse the first run's final payload
    expect(secondSnapshot?.fullRoast).toBe("First run roast. tl;dr: first.");
    expect(secondSnapshot?.events.some((e) => e.message === "Using cached analysis")).toBe(true);
  });

  it("uses similar cached run when canonical summary is >= 80% similar", async () => {
    const originalHtml = `
      <html>
        <head><title>Workflow SaaS</title></head>
        <body>
          <h1>Transform Your Workflow</h1>
          <section>Trusted by 10,000+ teams worldwide.</section>
          <section>Start your free trial today.</section>
        </body>
      </html>
    `;

    // First run
    const first = scanManager.startScan({
      url: "https://example.com",
      normalizedUrl: "https://example.com/",
    });

    await runScanJob(first.scanId, {
      fetchImpl: createMockFetch(originalHtml),
      runLighthouse: createMockLighthouse(),
      streamText: createMockStreamText("Original roast. tl;dr: original."),
    });

    // Slightly different HTML — change one word in proof
    const similarHtml = `
      <html>
        <head><title>Workflow SaaS</title></head>
        <body>
          <h1>Transform Your Workflow</h1>
          <section>Trusted by 10,000+ companies worldwide.</section>
          <section>Start your free trial today.</section>
        </body>
      </html>
    `;

    const second = scanManager.startScan({
      url: "https://example.com",
      normalizedUrl: "https://example.com/",
    });

    await runScanJob(second.scanId, {
      fetchImpl: createMockFetch(similarHtml),
      runLighthouse: createMockLighthouse(),
      streamText: createMockStreamText("New roast. tl;dr: new."),
    });

    const secondSnapshot = scanManager.getScan(second.scanId);
    expect(secondSnapshot?.status).toBe("COMPLETED");
    expect(secondSnapshot?.cacheState).toBe("cached");
    const firstSnapshot = scanManager.getScan(first.scanId);
    expect(secondSnapshot?.cachedFromSnapshotId).toBe(firstSnapshot?.snapshotHash);
    expect(secondSnapshot?.events.some((e) => e.message === "Using similar cached analysis")).toBe(true);
    expect(secondSnapshot?.events.some((e) => e.message === "CRAWL · HOMEPAGE https://example.com/")).toBe(true);
    expect(secondSnapshot?.events.some((e) => e.message.includes("LIGHTHOUSE(local) · Running mobile profile"))).toBe(true);
    expect(secondSnapshot?.fullRoast).toContain("Original roast. tl;dr: original.");
  });

  it("runs fresh when canonical summary is < 80% similar", async () => {
    const originalHtml = `
      <html>
        <head><title>Workflow SaaS</title></head>
        <body>
          <h1>Transform Your Workflow</h1>
          <section>Trusted by 10,000+ teams worldwide.</section>
          <section>Start your free trial today.</section>
        </body>
      </html>
    `;

    // First run
    const first = scanManager.startScan({
      url: "https://example.com",
      normalizedUrl: "https://example.com/",
    });

    await runScanJob(first.scanId, {
      fetchImpl: createMockFetch(originalHtml),
      runLighthouse: createMockLighthouse(),
      streamText: createMockStreamText("Original roast. tl;dr: original."),
    });

    // Drastically different HTML
    const differentHtml = `
      <html>
        <head><title>Cyberr Talent Network</title></head>
        <body>
          <h1>Hire Cybersecurity Experts</h1>
          <section>Vetted professionals only.</section>
          <section>Apply today and join the network.</section>
        </body>
      </html>
    `;

    const second = scanManager.startScan({
      url: "https://example.com",
      normalizedUrl: "https://example.com/",
    });

    await runScanJob(second.scanId, {
      fetchImpl: createMockFetch(differentHtml),
      runLighthouse: createMockLighthouse(),
      streamText: createMockStreamText("Different roast. tl;dr: different."),
    });

    const secondSnapshot = scanManager.getScan(second.scanId);
    expect(secondSnapshot?.status).toBe("COMPLETED");
    expect(secondSnapshot?.cacheState).toBe("fresh");
    expect(secondSnapshot?.cachedFromSnapshotId).toBeFalsy();
    expect(secondSnapshot?.events.some((e) => e.message === "Using similar cached analysis")).toBe(false);
    expect(secondSnapshot?.fullRoast).toBe("Different roast. tl;dr: different.");
  });

  it("restores completed scan instantly when accessed by scanId", async () => {
    const html = `
      <html>
        <head><title>Workflow SaaS</title></head>
        <body>
          <h1>Transform Your Workflow</h1>
          <section>Trusted by 10,000+ teams worldwide.</section>
        </body>
      </html>
    `;

    const first = scanManager.startScan({
      url: "https://example.com",
      normalizedUrl: "https://example.com/",
    });

    await runScanJob(first.scanId, {
      fetchImpl: createMockFetch(html),
      runLighthouse: createMockLighthouse(),
      streamText: createMockStreamText("Roast text. tl;dr: roast."),
    });

    // Simulate what the API does when GET /api/scans/:scanId is called
    const fromStore = await scanRunStore.getScan(first.scanId);
    expect(fromStore?.status).toBe("COMPLETED");
    expect(fromStore?.fullRoast).toBe("Roast text. tl;dr: roast.");
  });
});
