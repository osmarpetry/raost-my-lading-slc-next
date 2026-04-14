import { cancelScanRequestSchema, startScanRequestSchema } from "@/lib/shared/scans";
import { analysisCoordinator, scanManager } from "@/server/runtime";
import { runScanJob } from "@/server/scan-runtime";
import { scanRunStore } from "@/server/storage";
import { buildTestScanDeps } from "@/server/test-scan-deps";
import { normalizeAndValidateUrl } from "@/server/url-validation";

async function persistCurrentScan(scanId: string) {
  const snapshot = scanManager.getScan(scanId);
  if (!snapshot) {
    return;
  }

  const persistedState = scanRunStore.mode === "unavailable" ? "unavailable" : "persisted";
  scanManager.updateScan(scanId, (scan) => {
    scan.persistedRunId = persistedState === "persisted" ? scan.id : null;
    scan.persistedState = persistedState;
  });

  await scanRunStore.saveScan(
    scanManager.getScan(scanId) ?? snapshot,
  );
}

export async function startScan(payload: unknown) {
  const input = startScanRequestSchema.parse(payload);
  const normalizedUrl = await normalizeAndValidateUrl(input.url);

  if (input.replaceActiveScanId && scanManager.hasScan(input.replaceActiveScanId)) {
    scanManager.cancelScan(input.replaceActiveScanId, "Replaced by a newer scan.");
    await analysisCoordinator.detachScan(input.replaceActiveScanId);
  }

  const started = scanManager.startScan({
    url: input.url.trim(),
    normalizedUrl,
    clientSessionId: input.clientSessionId,
  });

  await persistCurrentScan(started.scanId);

  const initial = scanManager.getScan(started.scanId);
  const queuedEvent = initial?.events.at(-1);
  if (queuedEvent) {
    await scanRunStore.appendEvent(queuedEvent);
  }

  void runScanJob(started.scanId, buildTestScanDeps());

  return started;
}

export async function getScanSnapshot(scanId: string) {
  const memory = scanManager.getScan(scanId);
  if (memory) {
    return memory;
  }

  return scanRunStore.getScan(scanId);
}

export async function getScanArtifacts(scanId: string) {
  return scanRunStore.getArtifacts(scanId);
}

export async function cancelScan(scanId: string, payload: unknown) {
  cancelScanRequestSchema.parse(payload);
  const snapshot = scanManager.getScan(scanId) ?? (await scanRunStore.getScan(scanId));
  if (!snapshot) {
    return null;
  }

  scanManager.cancelScan(scanId, "Scan cancelled by user.");
  await analysisCoordinator.detachScan(scanId);
  await persistCurrentScan(scanId);
  const current = scanManager.getScan(scanId);
  const event = current?.events.at(-1);
  if (event) {
    await scanRunStore.appendEvent(event);
  }

  return scanManager.getScan(scanId) ?? snapshot;
}
