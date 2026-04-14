import type {
  AnalysisCacheStore,
  PersistedAnalysisState,
  PersistedCompletedRun,
  PersistedScanArtifacts,
  ScanRunStore,
} from "@/server/storage/types";
import { computeTextSimilarity } from "@/lib/server/snapshot-similarity";

export class MemoryAnalysisCacheStore implements AnalysisCacheStore {
  private readonly byAnalysisId = new Map<string, PersistedAnalysisState>();
  private readonly bySnapshotHash = new Map<string, string>();

  async getBySnapshotHash(snapshotHash: string) {
    const analysisId = this.bySnapshotHash.get(snapshotHash);
    return analysisId ? structuredClone(this.byAnalysisId.get(analysisId) ?? null) : null;
  }

  async getByAnalysisId(analysisId: string) {
    return structuredClone(this.byAnalysisId.get(analysisId) ?? null);
  }

  async save(state: PersistedAnalysisState) {
    this.byAnalysisId.set(state.analysisId, structuredClone(state));
    this.bySnapshotHash.set(state.snapshotHash, state.analysisId);
  }

  async appendLog(analysisId: string, message: string) {
    const current = this.byAnalysisId.get(analysisId);
    if (!current) {
      return;
    }

    current.logs.push(message);
  }

  async clear() {
    this.byAnalysisId.clear();
    this.bySnapshotHash.clear();
  }
}

interface MemoryRunEntry {
  scan: PersistedCompletedRun["scan"];
  artifacts: PersistedScanArtifacts;
}

export class MemoryScanRunStore implements ScanRunStore {
  readonly mode = "memory" as const;
  private readonly scans = new Map<string, MemoryRunEntry>();
  private forceSimilarity: number | null = null;

  setForceSimilarity(value: number | null) {
    this.forceSimilarity = value;
  }

  async saveScan(scan: PersistedCompletedRun["scan"], artifacts: PersistedScanArtifacts = {}) {
    const current = this.scans.get(scan.id);
    const scanCanonicalSummary = (scan as unknown as Record<string, string>).canonicalSummary ?? null;
    const mergedArtifacts = structuredClone({
      ...(current?.artifacts ?? {}),
      ...artifacts,
    });
    if (!mergedArtifacts.canonicalSummary && scanCanonicalSummary) {
      mergedArtifacts.canonicalSummary = scanCanonicalSummary;
    }
    this.scans.set(scan.id, {
      scan: structuredClone({
        ...scan,
        persistedRunId: scan.id,
        persistedState: "persisted",
        canonicalSummary: mergedArtifacts.canonicalSummary ?? scanCanonicalSummary,
      }),
      artifacts: mergedArtifacts,
    });
  }

  async appendEvent(event: PersistedCompletedRun["scan"]["events"][number]) {
    const entry = this.scans.get(event.scanId);
    if (!entry) {
      return;
    }

    if (entry.scan.events.some((existing) => existing.seq === event.seq)) {
      return;
    }

    entry.scan.events.push(structuredClone(event));
    entry.scan.events.sort((left, right) => left.seq - right.seq);
    entry.scan.updatedAt = event.createdAt;
  }

  async getScan(scanId: string) {
    return structuredClone(this.scans.get(scanId)?.scan ?? null);
  }

  async getArtifacts(scanId: string) {
    const entry = this.scans.get(scanId);
    if (!entry) {
      return null;
    }

    return structuredClone({
      run: entry.scan,
      routeMapJson: entry.artifacts.routeMapJson ?? null,
      pagesJson: entry.artifacts.pagesJson ?? null,
      externalLinksJson: entry.artifacts.externalLinksJson ?? null,
      lighthouseMobileJson: entry.artifacts.lighthouseMobileJson ?? null,
      lighthouseDesktopJson: entry.artifacts.lighthouseDesktopJson ?? null,
      siteUnderstandingJson: entry.artifacts.siteUnderstandingJson ?? null,
      finalPayloadJson: entry.artifacts.finalPayloadJson ?? null,
      eventLog: entry.scan.events,
    });
  }

  async findCompletedBySnapshotHash(snapshotHash: string) {
    const match = [...this.scans.values()]
      .map((entry) => entry.scan)
      .find((scan) => scan.snapshotHash === snapshotHash && scan.status === "COMPLETED" && scan.finalPayload);

    if (!match || !match.finalPayload) {
      return null;
    }

    return structuredClone({
      scan: match,
      finalPayload: match.finalPayload,
      providerStatus: match.providerStatus,
    });
  }

  async findSimilarCompletedRun(
    normalizedUrl: string,
    snapshotHash: string,
    canonicalSummary: string,
    threshold = 0.8,
  ) {
    const candidates = [...this.scans.values()]
      .filter(
        (entry) =>
          entry.scan.normalizedUrl === normalizedUrl &&
          entry.scan.status === "COMPLETED" &&
          entry.scan.snapshotHash !== snapshotHash &&
          entry.scan.finalPayload,
      )
      .sort((a, b) => (new Date(b.scan.updatedAt ?? 0).getTime() - new Date(a.scan.updatedAt ?? 0).getTime()));

    for (const entry of candidates.slice(0, 20)) {
      const summary = entry.artifacts.canonicalSummary ?? "";
      const similarity = this.forceSimilarity !== null
        ? this.forceSimilarity
        : computeTextSimilarity(canonicalSummary, summary);
      if (similarity >= threshold && entry.scan.finalPayload) {
        return structuredClone({
          scan: entry.scan,
          finalPayload: entry.scan.finalPayload,
          providerStatus: entry.scan.providerStatus,
        });
      }
    }

    return null;
  }

  async clear() {
    this.forceSimilarity = null;
    this.scans.clear();
  }
}

export class UnavailableScanRunStore implements ScanRunStore {
  readonly mode = "unavailable" as const;

  constructor(readonly reason: string) {}

  async saveScan() {}

  async appendEvent() {}

  async getScan() {
    return null;
  }

  async getArtifacts() {
    return null;
  }

  async findCompletedBySnapshotHash() {
    return null;
  }

  async findSimilarCompletedRun() {
    return null;
  }

  async clear() {}
}
