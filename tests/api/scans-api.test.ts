/* @vitest-environment node */

import { io } from "socket.io-client";

import { analysisCoordinator, scanManager } from "@/server/runtime";
import { scanArtifactsResponseSchema, scanJobSchema } from "@/lib/shared/scans";
import { startTestServer } from "./support/test-server";

async function waitFor<T>(
  factory: () => T | Promise<T>,
  timeoutMs = 10_000,
  intervalMs = 50,
): Promise<T> {
  const startedAt = Date.now();

  while (true) {
    const value = await factory();
    if (value) {
      return value;
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Timed out while waiting for test condition.");
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

describe("scans API", () => {
  let baseUrl = "";
  let closeServer: (() => Promise<void>) | undefined;
  const previousMockScan = process.env.SLC_MOCK_SCAN;

  beforeAll(async () => {
    process.env.SLC_MOCK_SCAN = "true";
    const server = await startTestServer();
    baseUrl = server.baseUrl;
    closeServer = server.close;
  });

  beforeEach(() => {
    scanManager.clear();
    return analysisCoordinator.clear();
  });

  afterAll(async () => {
    await closeServer?.();
    if (previousMockScan === undefined) {
      delete process.env.SLC_MOCK_SCAN;
    } else {
      process.env.SLC_MOCK_SCAN = previousMockScan;
    }
  });

  it("POST /api/scans creates a scan", async () => {
    const response = await fetch(`${baseUrl}/api/scans`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ url: "https://example.com" }),
    });

    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.scanId).toBeTruthy();
    expect(body.scan.normalizedUrl).toContain("https://example.com");
  });

  it("GET /api/scans/:scanId returns the current snapshot", async () => {
    const created = await fetch(`${baseUrl}/api/scans`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ url: "https://example.com" }),
    });
    const started = (await created.json()) as { scanId: string };

    const response = await fetch(`${baseUrl}/api/scans/${started.scanId}`);
    const body = scanJobSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.id).toBe(started.scanId);
  });

  it("GET /api/scans/:scanId/artifacts returns persisted artifacts envelope", async () => {
    const created = await fetch(`${baseUrl}/api/scans`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ url: "https://example.com" }),
    });
    const started = (await created.json()) as { scanId: string };

    const response = await fetch(`${baseUrl}/api/scans/${started.scanId}/artifacts`);
    const body = scanArtifactsResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.run.id).toBe(started.scanId);
    expect(body.eventLog.length).toBeGreaterThan(0);
  });

  it("socket subscriptions receive scan progress events", async () => {
    const created = await fetch(`${baseUrl}/api/scans`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ url: "https://example.com" }),
    });
    const started = (await created.json()) as { scanId: string };

    const eventTypes: string[] = [];
    const snapshots: string[] = [];
    const socket = io(baseUrl, {
      autoConnect: false,
      path: "/socket.io",
      transports: ["websocket"],
    });

    socket.on("scan:event", (event) => {
      eventTypes.push(event.eventType);
    });
    socket.on("scan:snapshot", (snapshot) => {
      snapshots.push(snapshot.status);
    });

    socket.connect();
    await waitFor(() => socket.connected);
    socket.emit("scan:subscribe", { scanId: started.scanId });

    await waitFor(() => snapshots.length > 0 || eventTypes.length > 0);
    expect(snapshots.length + eventTypes.length).toBeGreaterThan(0);

    socket.disconnect();
  });

  it("GET /api/scans/:scanId returns a completed scan for direct route access", async () => {
    const created = await fetch(`${baseUrl}/api/scans`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ url: "https://example.com" }),
    });
    const started = (await created.json()) as { scanId: string };

    // Poll until completion
    let scan = await fetch(`${baseUrl}/api/scans/${started.scanId}`).then((r) => r.json());
    const deadline = Date.now() + 15_000;
    while (scan.status !== "COMPLETED" && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      scan = await fetch(`${baseUrl}/api/scans/${started.scanId}`).then((r) => r.json());
    }

    expect(scan.status).toBe("COMPLETED");
    expect(scan.id).toBe(started.scanId);
    expect(scan.fullRoast).toBeTruthy();
    expect(scan.qualityScore).not.toBeNull();

    // Second GET should still be completed instantly
    const secondGet = await fetch(`${baseUrl}/api/scans/${started.scanId}`);
    const secondScan = scanJobSchema.parse(await secondGet.json());
    expect(secondScan.status).toBe("COMPLETED");
  });

  it("POST /api/scans reuses exact snapshot cache on identical URL", async () => {
    const body = JSON.stringify({ url: "https://example.com" });

    const first = await fetch(`${baseUrl}/api/scans`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    const firstStarted = (await first.json()) as { scanId: string };

    // Wait for first to complete
    let firstScan = await fetch(`${baseUrl}/api/scans/${firstStarted.scanId}`).then((r) => r.json());
    const deadline = Date.now() + 15_000;
    while (firstScan.status !== "COMPLETED" && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      firstScan = await fetch(`${baseUrl}/api/scans/${firstStarted.scanId}`).then((r) => r.json());
    }
    expect(firstScan.status).toBe("COMPLETED");

    // Second scan with same URL
    const second = await fetch(`${baseUrl}/api/scans`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    const secondStarted = (await second.json()) as { scanId: string };

    // Should complete almost instantly because of exact cache
    let secondScan = await fetch(`${baseUrl}/api/scans/${secondStarted.scanId}`).then((r) => r.json());
    const instantDeadline = Date.now() + 2_000;
    while (secondScan.status !== "COMPLETED" && Date.now() < instantDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      secondScan = await fetch(`${baseUrl}/api/scans/${secondStarted.scanId}`).then((r) => r.json());
    }

    expect(secondScan.status).toBe("COMPLETED");
    expect(secondScan.cacheState).toBe("cached");
    expect(secondScan.fullRoast).toBe(firstScan.fullRoast);
  });
});
