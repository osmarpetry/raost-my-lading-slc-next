import { renderHook } from "@testing-library/react";

import { useScanSubscription } from "@/lib/realtime/use-scan-subscription";

const firstScanId = "11111111-1111-1111-1111-111111111111";
const secondScanId = "22222222-2222-2222-2222-222222222222";

class FakeSocket {
  connected = false;
  emitted: Array<{ event: string; payload: unknown }> = [];
  handlers = new Map<string, Set<(...args: unknown[]) => void>>();

  on(event: string, handler: (...args: unknown[]) => void) {
    const existing = this.handlers.get(event) ?? new Set();
    existing.add(handler);
    this.handlers.set(event, existing);
    return this;
  }

  off(event: string, handler: (...args: unknown[]) => void) {
    this.handlers.get(event)?.delete(handler);
    return this;
  }

  emit(event: string, payload: unknown) {
    this.emitted.push({ event, payload });
  }

  connect() {
    this.connected = true;
    this.handlers.get("connect")?.forEach((handler) => handler());
  }

  disconnect() {
    this.connected = false;
    this.handlers.get("disconnect")?.forEach((handler) => handler());
  }
}

describe("useScanSubscription", () => {
  it("subscribes and unsubscribes correctly", () => {
    const socket = new FakeSocket();

    const { rerender, unmount } = renderHook(
      ({ scanId }) =>
        useScanSubscription({
          scanId,
          socketFactory: () => socket,
        }),
      {
        initialProps: { scanId: firstScanId as string | null },
      },
    );

    expect(socket.emitted).toContainEqual({
      event: "scan:subscribe",
      payload: { scanId: firstScanId },
    });

    rerender({ scanId: secondScanId });

    expect(socket.emitted).toContainEqual({
      event: "scan:unsubscribe",
      payload: { scanId: firstScanId },
    });
    expect(socket.emitted).toContainEqual({
      event: "scan:subscribe",
      payload: { scanId: secondScanId },
    });

    unmount();

    expect(socket.emitted).toContainEqual({
      event: "scan:unsubscribe",
      payload: { scanId: secondScanId },
    });
  });
});
