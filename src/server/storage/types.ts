import type {
  AnalysisCheckpoint,
  FinalRoastPayload,
  LighthouseInterpretationSkillOutput,
  LighthouseProfiles,
  PageContentSnapshot,
  ProviderStatus,
  RouteMapSummary,
  ScanArtifactsResponse,
  ScanEvent,
  ScanJob,
  SiteUnderstandingSkillOutput,
  ExternalLinkSummary,
} from "@/lib/shared/scans";

export interface PersistedAnalysisState extends AnalysisCheckpoint {
  lighthouseProfiles?: LighthouseProfiles;
  lighthouseInterpretation?: LighthouseInterpretationSkillOutput;
  siteUnderstanding?: SiteUnderstandingSkillOutput;
  promptPackId?: string;
  mergedPrompt?: string;
  finalPayload?: FinalRoastPayload | null;
  logs: string[];
}

export interface PersistedScanArtifacts {
  routeMapJson?: RouteMapSummary | null;
  pagesJson?: PageContentSnapshot[] | null;
  externalLinksJson?: ExternalLinkSummary[] | null;
  lighthouseMobileJson?: Record<string, unknown> | null;
  lighthouseDesktopJson?: Record<string, unknown> | null;
  siteUnderstandingJson?: SiteUnderstandingSkillOutput | null;
  finalPayloadJson?: FinalRoastPayload | null;
  canonicalSummary?: string | null;
}

export interface PersistedCompletedRun {
  scan: ScanJob;
  finalPayload: FinalRoastPayload;
  providerStatus: ProviderStatus;
}

export interface AnalysisCacheStore {
  getBySnapshotHash(snapshotHash: string): Promise<PersistedAnalysisState | null>;
  getByAnalysisId(analysisId: string): Promise<PersistedAnalysisState | null>;
  save(state: PersistedAnalysisState): Promise<void>;
  appendLog(analysisId: string, message: string): Promise<void>;
  clear(): Promise<void>;
}

export interface ScanRunStore {
  mode: "database" | "memory" | "unavailable";
  reason?: string;
  saveScan(scan: ScanJob, artifacts?: PersistedScanArtifacts): Promise<void>;
  appendEvent(event: ScanEvent): Promise<void>;
  getScan(scanId: string): Promise<ScanJob | null>;
  getArtifacts(scanId: string): Promise<ScanArtifactsResponse | null>;
  findCompletedBySnapshotHash(snapshotHash: string): Promise<PersistedCompletedRun | null>;
  findSimilarCompletedRun(
    normalizedUrl: string,
    snapshotHash: string,
    canonicalSummary: string,
    threshold?: number,
  ): Promise<PersistedCompletedRun | null>;
  clear(): Promise<void>;
}
