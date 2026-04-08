import { startScanRequestSchema } from "@/lib/shared/scans";
import { scanManager } from "@/server/runtime";
import { runScanJob } from "@/server/scan-runtime";
import { normalizeAndValidateUrl } from "@/server/url-validation";

export async function startScan(payload: unknown) {
  const input = startScanRequestSchema.parse(payload);
  const normalizedUrl = await normalizeAndValidateUrl(input.url);

  const started = scanManager.startScan({
    url: input.url.trim(),
    normalizedUrl,
  });

  void runScanJob(started.scanId);

  return started;
}

export function getScanSnapshot(scanId: string) {
  return scanManager.getScan(scanId);
}
