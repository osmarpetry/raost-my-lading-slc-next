import { describeScanEvent, renderCompletedScan } from "@/lib/terminal/format";
import type { ScanEvent, ScanJob } from "@/lib/shared/scans";

describe("terminal formatter", () => {
  it("emits prose lines for SCAN_STAGE events, never raw JSON", () => {
    const event: ScanEvent = {
      scanId: "11111111-1111-1111-1111-111111111111",
      seq: 1,
      eventType: "SCAN_STAGE",
      stage: "QUALITY",
      message: "LIGHTHOUSE(local) · Mobile 71, Desktop 84, Combined 78",
      payloadJson: JSON.stringify({ flushStream: true }),
      createdAt: new Date().toISOString(),
    };

    const render = describeScanEvent(event);
    expect(render.lines.length).toBeGreaterThan(0);
    for (const line of render.lines) {
      expect(line.text).not.toMatch(/^\s*\{/);
      expect(typeof line.text).toBe("string");
    }
  });

  it("emits prose for completed scan, never raw JSON", () => {
    const scan: ScanJob = {
      id: "11111111-1111-1111-1111-111111111111",
      status: "COMPLETED",
      providerStatus: {
        lighthouse: {
          provider: "lighthouse",
          source: "local",
          reason: "completed",
        },
        openai: {
          provider: "openai",
          source: "live",
          reason: "completed",
          model: "gpt-5.4-nano",
        },
      },
      lighthouseProfiles: {
        mobile: {
          score: 71,
          band: "PASSABLE",
          snapshot: {
            performance: 65,
            accessibility: 75,
            bestPractices: 70,
            seo: 74,
            strategy: "mobile",
            source: "local",
          },
        },
        desktop: {
          score: 84,
          band: "STRONG",
          snapshot: {
            performance: 82,
            accessibility: 86,
            bestPractices: 83,
            seo: 85,
            strategy: "desktop",
            source: "local",
          },
        },
      },
      findings: [],
      events: [],
      qualityScore: 78,
      qualityBand: "PASSABLE",
      previewRoast: "Mock preview roast.",
      fullRoast: "Mock full roast text.",
    };

    const lines = renderCompletedScan(scan);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line.text).not.toMatch(/^\s*\{/);
      expect(typeof line.text).toBe("string");
    }
    expect(lines.some((l) => l.text.includes("Combined 78"))).toBe(true);
  });
});
