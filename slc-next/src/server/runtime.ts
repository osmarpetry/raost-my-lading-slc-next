import { AnalysisCoordinator } from "@/server/analysis-coordinator";
import { ScanManager } from "@/server/scan-manager";

declare global {
  var __slcAnalysisCoordinator: AnalysisCoordinator | undefined;
  var __slcScanManager: ScanManager | undefined;
}

export const scanManager = globalThis.__slcScanManager ?? new ScanManager();
export const analysisCoordinator =
  globalThis.__slcAnalysisCoordinator ?? new AnalysisCoordinator();

if (process.env.NODE_ENV !== "production") {
  globalThis.__slcAnalysisCoordinator = analysisCoordinator;
  globalThis.__slcScanManager = scanManager;
}
