/* @vitest-environment node */

import { MemoryScanRunStore } from "@/server/storage/memory-store";
import type { ScanJob } from "@/lib/shared/scans";

function createCompletedScan(overrides: Partial<ScanJob> = {}): ScanJob {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    persistedRunId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    persistedState: "persisted",
    url: "https://example.com",
    normalizedUrl: "https://example.com/",
    rootUrl: "https://example.com/",
    analysisId: null,
    snapshotHash: "hash-original",
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
      usedSnapshotHash: "hash-original",
      usedPromptPackId: "pack-passable",
      usedSources: ["snapshot", "lighthouse", "openai"],
      finalText: "Tighten headline and bring proof higher. tl;dr: headline + proof.",
    },
    findings: [],
    events: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    canonicalSummary: "Hero: Transform Your Workflow\nCTA: Start your free trial today\nProof: Trusted by 10,000+ teams worldwide\nPages: https://example.com/ title=Example h1=Example heading cta=Start now snippet=Build better pages fast.",
    ...overrides,
  } as ScanJob;
}

describe("MemoryScanRunStore.findSimilarCompletedRun", () => {
  let store: MemoryScanRunStore;

  beforeEach(() => {
    store = new MemoryScanRunStore();
  });

  it("returns null when no completed scans exist", async () => {
    const result = await store.findSimilarCompletedRun(
      "https://example.com/",
      "hash-new",
      "Some summary",
    );
    expect(result).toBeNull();
  });

  it("returns null when only the exact same snapshot hash exists", async () => {
    const scan = createCompletedScan();
    await store.saveScan(scan);

    const result = await store.findSimilarCompletedRun(
      "https://example.com/",
      "hash-original",
  (scan as unknown as { canonicalSummary?: string }).canonicalSummary ?? "",
    );
    expect(result).toBeNull();
  });

  it("returns the similar run when canonical summary is >= 80% similar", async () => {
    const original = createCompletedScan();
    await store.saveScan(original);

    const similarSummary =
      "Hero: Transform Your Workflow\nCTA: Start your free trial today\nProof: Trusted by 10,000+ companies globally\nPages: https://example.com/ title=Example h1=Example heading cta=Start now snippet=Build better pages fast.";

    const result = await store.findSimilarCompletedRun(
      "https://example.com/",
      "hash-new",
      similarSummary,
    );

    expect(result).not.toBeNull();
    expect(result?.scan.id).toBe(original.id);
    expect(result?.finalPayload.finalText).toBe(original.finalPayload?.finalText);
  });

  it("returns null when canonical summary is < 80% similar", async () => {
    const original = createCompletedScan();
    await store.saveScan(original);

    const differentSummary =
      "Hero: Hire Cybersecurity Experts\nCTA: Apply today\nProof: Vetted professionals only\nPages: https://cyberr.ai/ title=Cyberr h1=Cyber network cta=Join snippet=Cyber security talent network.";

    const result = await store.findSimilarCompletedRun(
      "https://example.com/",
      "hash-new",
      differentSummary,
    );

    expect(result).toBeNull();
  });

  it("returns null when normalized url differs even with identical summary", async () => {
    const original = createCompletedScan();
    await store.saveScan(original);

    const result = await store.findSimilarCompletedRun(
      "https://other-site.com/",
      "hash-new",
      (original as unknown as { canonicalSummary?: string }).canonicalSummary ?? "",
    );

    expect(result).toBeNull();
  });

  it("prefers the most recently updated scan when multiple similar ones exist", async () => {
    const older = createCompletedScan({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
      snapshotHash: "hash-older",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const newer = createCompletedScan({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02",
      snapshotHash: "hash-newer",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });

    await store.saveScan(older);
    await store.saveScan(newer);

    const similarSummary =
      "Hero: Transform Your Workflow\nCTA: Start your free trial today\nProof: Trusted by 10,000+ teams worldwide\nPages: https://example.com/ title=Example h1=Example heading cta=Start now snippet=Build better pages fast.";

    const result = await store.findSimilarCompletedRun(
      "https://example.com/",
      "hash-latest",
      similarSummary,
    );

    expect(result?.scan.id).toBe(newer.id);
  });
});
