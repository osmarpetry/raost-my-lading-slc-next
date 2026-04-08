/* @vitest-environment node */

import { ScanManager } from "@/server/scan-manager";

describe("ScanManager", () => {
  it("emits the expected sequence and terminal state", async () => {
    const manager = new ScanManager();
    const started = manager.startScan({
      url: "https://example.com",
      normalizedUrl: "https://example.com/",
    });

    await manager.runScan(started.scanId, async ({ appendEvent, updateScan }) => {
      appendEvent("SCAN_STAGE", "RUNNING", "Scan started");
      appendEvent("SCAN_STAGE", "QUALITY", "Running Lighthouse");
      appendEvent("LLM_CHUNK", "OLLAMA", "Streaming roast text", {
        textDelta: "chunk",
      });
      updateScan((scan) => {
        scan.previewRoast = "Preview";
      });
      appendEvent("JOB_COMPLETED", "COMPLETED", "Scan completed");
    });

    const snapshot = manager.getScan(started.scanId);
    expect(snapshot?.events.map((event) => event.seq)).toEqual([1, 2, 3, 4, 5]);
    expect(snapshot?.events[0]).toMatchObject({
      eventType: "SCAN_STAGE",
      stage: "QUEUED",
      message: "Scan queued",
    });
    expect(snapshot?.status).toBe("COMPLETED");
    expect(snapshot?.previewRoast).toBe("Preview");
  });
});
