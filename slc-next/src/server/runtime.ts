import { ScanManager } from "@/server/scan-manager";

declare global {
  var __slcScanManager: ScanManager | undefined;
}

export const scanManager = globalThis.__slcScanManager ?? new ScanManager();

if (process.env.NODE_ENV !== "production") {
  globalThis.__slcScanManager = scanManager;
}
