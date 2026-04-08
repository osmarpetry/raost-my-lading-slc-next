/* @vitest-environment node */

import { io } from "socket.io-client";

import { scanManager } from "@/server/runtime";
import { scanJobSchema } from "@/lib/shared/scans";
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

  beforeAll(async () => {
    const server = await startTestServer();
    baseUrl = server.baseUrl;
    closeServer = server.close;
  });

  beforeEach(() => {
    scanManager.clear();
  });

  afterAll(async () => {
    await closeServer?.();
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
    const socket = io(baseUrl, {
      autoConnect: false,
      path: "/socket.io",
      transports: ["websocket"],
    });

    socket.on("scan:event", (event) => {
      eventTypes.push(event.eventType);
    });

    socket.connect();
    await waitFor(() => socket.connected);
    socket.emit("scan:subscribe", { scanId: started.scanId });

    await waitFor(() => eventTypes.includes("SCAN_STAGE"));
    expect(eventTypes).toContain("SCAN_STAGE");

    socket.disconnect();
  });
});
