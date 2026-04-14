/* @vitest-environment node */

import { AnalysisCoordinator } from "@/server/analysis-coordinator";
import { analysisCacheStore, scanRunStore } from "@/server/storage";
import type { ScanJob } from "@/lib/shared/scans";
import type { PersistedAnalysisState } from "@/server/storage/types";

function createCompletedScan(overrides: Partial<ScanJob & { canonicalSummary?: string | null }> = {}): ScanJob {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    persistedRunId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    persistedState: "persisted",
    url: "https://example.com",
    normalizedUrl: "https://example.com/",
    rootUrl: "https://example.com/",
    analysisId: "analysis-1",
    snapshotHash: "hash-exact",
    cacheState: "fresh",
    currentStep: "COMPLETED",
    finalResponseState: "COMPLETED",
    status: "COMPLETED",
    errorMessage: null,
    previewRoast: "Preview.",
    fullRoast: "Full roast text.",
    qualityScore: 74,
    qualityBand: "PASSABLE",
    providerStatus: {
      lighthouse: { provider: "lighthouse", source: "local" },
      openai: { provider: "openai", source: "live" },
    },
    lighthouseProfiles: {
      mobile: { score: 71, band: "PASSABLE", snapshot: { strategy: "mobile", source: "local" } },
      desktop: { score: 77, band: "STRONG", snapshot: { strategy: "desktop", source: "local" } },
    },
    siteUnderstanding: null,
    lighthouseInterpretation: null,
    finalPayload: {
      headlineDiagnosis: "Headline is vague.",
      whatSiteSells: "Workflow software",
      whoItTargets: ["Founders"],
      compliments: ["Good hero", "Clear CTA", "Strong proof"],
      priorityFixes: ["Add pricing", "Tighten headline", "More social proof"],
      quickWins0to3Days: ["Add testimonials", "Fix CTA color"],
      finalRoast: "Tighten headline and bring proof higher.",
      confidence: 0.82,
      usedSnapshotHash: "hash-exact",
      usedPromptPackId: "pack-passable",
      usedSources: ["snapshot", "lighthouse", "openai"],
      finalText: "Tighten headline and bring proof higher. tl;dr: headline + proof.",
    },
    findings: [],
    events: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as ScanJob;
}

function createAnalysisState(
  overrides: Partial<PersistedAnalysisState> = {},
): PersistedAnalysisState {
  return {
    analysisId: "analysis-1",
    snapshotHash: "hash-exact",
    normalizedUrl: "https://example.com/",
    rootUrl: "https://example.com/",
    routeMap: { rootUrl: "https://example.com/", scannedUrls: [], childUrls: [] },
    pages: [],
    externalLinks: [],
    status: "RUNNING",
    currentStep: "INITIALIZED",
    finalChunks: [],
    lastFinalText: "",
    logs: [],
    ...overrides,
  };
}

describe("AnalysisCoordinator.attachOrCreate decision logic", () => {
  let coordinator: AnalysisCoordinator;

  beforeEach(async () => {
    await scanRunStore.clear();
    await analysisCacheStore.clear();
    coordinator = new AnalysisCoordinator();
    await coordinator.clear();
  });

  afterEach(async () => {
    await scanRunStore.clear();
    await analysisCacheStore.clear();
    await coordinator.clear();
  });

  it("returns fresh for a first-time scan with no prior state", async () => {
    const result = await coordinator.attachOrCreate({
      scanId: "scan-1",
      snapshotHash: "hash-new",
      normalizedUrl: "https://new-site.com/",
      rootUrl: "https://new-site.com/",
      routeMap: { rootUrl: "https://new-site.com/", scannedUrls: [], childUrls: [] },
      pages: [],
      externalLinks: [],
    });

    expect(result.cacheState).toBe("fresh");
    expect("shouldStart" in result && result.shouldStart).toBe(true);
  });

  it("returns cached when an exact snapshot hash already exists as completed", async () => {
    const scan = createCompletedScan({ snapshotHash: "hash-exact" });
    await scanRunStore.saveScan(scan);

    const result = await coordinator.attachOrCreate({
      scanId: "scan-2",
      snapshotHash: "hash-exact",
      normalizedUrl: "https://example.com/",
      rootUrl: "https://example.com/",
      routeMap: { rootUrl: "https://example.com/", scannedUrls: [], childUrls: [] },
      pages: [],
      externalLinks: [],
    });

    expect(result.cacheState).toBe("cached");
    expect("completedRun" in result && result.completedRun).toBeTruthy();
    expect("completedRun" in result && result.completedRun?.scan.snapshotHash).toBe("hash-exact");
  });

  it("returns attached when an active in-flight analysis exists for the same snapshot hash", async () => {
    const first = await coordinator.attachOrCreate({
      scanId: "scan-1",
      snapshotHash: "hash-active",
      normalizedUrl: "https://example.com/",
      rootUrl: "https://example.com/",
      routeMap: { rootUrl: "https://example.com/", scannedUrls: [], childUrls: [] },
      pages: [],
      externalLinks: [],
    });
    expect(first.cacheState).toBe("fresh");

    const second = await coordinator.attachOrCreate({
      scanId: "scan-2",
      snapshotHash: "hash-active",
      normalizedUrl: "https://example.com/",
      rootUrl: "https://example.com/",
      routeMap: { rootUrl: "https://example.com/", scannedUrls: [], childUrls: [] },
      pages: [],
      externalLinks: [],
    });

    expect(second.cacheState).toBe("attached");
    expect("shouldStart" in second && second.shouldStart).toBe(true);
  });

  it("returns resumed when a persisted analysis cache exists but is not in memory", async () => {
    const state = createAnalysisState({ snapshotHash: "hash-resumed" });
    await analysisCacheStore.save(state);

    // Create a fresh coordinator so the state is not in memory
    const freshCoordinator = new AnalysisCoordinator();

    const result = await freshCoordinator.attachOrCreate({
      scanId: "scan-1",
      snapshotHash: "hash-resumed",
      normalizedUrl: "https://example.com/",
      rootUrl: "https://example.com/",
      routeMap: { rootUrl: "https://example.com/", scannedUrls: [], childUrls: [] },
      pages: [],
      externalLinks: [],
    });

    expect(result.cacheState).toBe("resumed");
    expect("shouldStart" in result && result.shouldStart).toBe(true);
  });

  it("finds similar completed run when canonical summary is >= 80% similar", async () => {
    const scan = createCompletedScan({
      id: "scan-original",
      snapshotHash: "hash-original",
      canonicalSummary:
        "Hero: Transform Your Workflow\nCTA: Start your free trial today\nProof: Trusted by 10,000+ teams worldwide",
    });
    await scanRunStore.saveScan(scan, {
      canonicalSummary:
        "Hero: Transform Your Workflow\nCTA: Start your free trial today\nProof: Trusted by 10,000+ teams worldwide",
    });

    const similarSummary =
      "Hero: Transform Your Workflow\nCTA: Start your free trial today\nProof: Trusted by 10,000+ companies globally";

    const result = await scanRunStore.findSimilarCompletedRun(
      "https://example.com/",
      "hash-new",
      similarSummary,
    );

    expect(result).not.toBeNull();
    expect(result?.scan.id).toBe("scan-original");
  });

  it("returns null for similar run when canonical summary is < 80% similar", async () => {
    const scan = createCompletedScan({
      id: "scan-original",
      snapshotHash: "hash-original",
      canonicalSummary:
        "Hero: Transform Your Workflow\nCTA: Start your free trial today\nProof: Trusted by 10,000+ teams worldwide",
    });
    await scanRunStore.saveScan(scan, {
      canonicalSummary:
        "Hero: Transform Your Workflow\nCTA: Start your free trial today\nProof: Trusted by 10,000+ teams worldwide",
    });

    const differentSummary =
      "Hero: Hire Cybersecurity Experts\nCTA: Apply today\nProof: Vetted professionals only";

    const result = await scanRunStore.findSimilarCompletedRun(
      "https://example.com/",
      "hash-new",
      differentSummary,
    );

    expect(result).toBeNull();
  });
});
