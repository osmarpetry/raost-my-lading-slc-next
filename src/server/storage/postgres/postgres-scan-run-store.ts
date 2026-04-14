import { and, desc, eq, ne, sql } from "drizzle-orm";
import type { Pool } from "pg";

import type {
  ExternalLinkSummary,
  FinalRoastPayload,
  PageContentSnapshot,
  QualityBand,
  RouteMapSummary,
  ScanArtifactsResponse,
  ScanEvent,
  ScanJob,
  SiteUnderstandingSkillOutput,
} from "@/lib/shared/scans";
import { computeTextSimilarity } from "@/lib/server/snapshot-similarity";
import { scanJobSchema } from "@/lib/shared/scans";
import { createPostgresDb, createPostgresPool } from "@/server/storage/postgres/db";
import { scanEvents, scanRuns } from "@/server/storage/postgres/schema";
import type {
  PersistedCompletedRun,
  PersistedScanArtifacts,
  ScanRunStore,
} from "@/server/storage/types";

function parseJson<T>(value: unknown, fallback: T): T {
  return (value as T) ?? fallback;
}

function coerceQualityBand(value: string | null): QualityBand | null {
  if (!value) {
    return null;
  }

  if (["EXCELLENT", "STRONG", "PASSABLE", "WEAK", "BROKEN"].includes(value)) {
    return value as QualityBand;
  }

  return null;
}

function coerceLighthouseSource(value: string) {
  if (value === "local" || value === "pagespeed" || value === "disabled" || value === "failed") {
    return value;
  }

  return "failed" as const;
}

function coerceOpenAiSource(value: string) {
  if (value === "live" || value === "disabled" || value === "failed") {
    return value;
  }

  return "failed" as const;
}

export class PostgresScanRunStore implements ScanRunStore {
  readonly mode = "database" as const;
  private readonly db;

  constructor(private readonly pool: Pool) {
    this.db = createPostgresDb(pool);
  }

  static create(url: string) {
    return new PostgresScanRunStore(createPostgresPool(url));
  }

  async saveScan(scan: ScanJob, artifacts: PersistedScanArtifacts = {}) {
    await this.db
      .insert(scanRuns)
      .values({
        id: scan.id,
        submittedUrl: scan.url ?? scan.normalizedUrl ?? "",
        normalizedUrl: scan.normalizedUrl ?? scan.url ?? "",
        rootUrl: scan.rootUrl ?? null,
        status: scan.status,
        currentStep: scan.currentStep ?? null,
        snapshotHash: scan.snapshotHash ?? null,
        qualityScore: scan.qualityScore ?? null,
        qualityBand: scan.qualityBand ?? null,
        mobileLighthouseScore: scan.lighthouseProfiles.mobile?.score ?? null,
        desktopLighthouseScore: scan.lighthouseProfiles.desktop?.score ?? null,
        lighthouseSource: scan.providerStatus.lighthouse.source,
        lighthouseReason: scan.providerStatus.lighthouse.reason ?? null,
        openaiSource: scan.providerStatus.openai.source,
        openaiReason: scan.providerStatus.openai.reason ?? null,
        openaiModel: scan.providerStatus.openai.model ?? null,
        routeMapJson: artifacts.routeMapJson ?? null,
        pagesJson: artifacts.pagesJson ?? null,
        externalLinksJson: artifacts.externalLinksJson ?? null,
        lighthouseMobileJson: artifacts.lighthouseMobileJson ?? null,
        lighthouseDesktopJson: artifacts.lighthouseDesktopJson ?? null,
        siteUnderstandingJson: artifacts.siteUnderstandingJson ?? null,
        finalPayloadJson: artifacts.finalPayloadJson ?? scan.finalPayload ?? null,
        finalText: scan.fullRoast ?? null,
        previewText: scan.previewRoast ?? null,
        canonicalSummary: artifacts.canonicalSummary ?? null,
        errorMessage: scan.errorMessage ?? null,
        createdAt: scan.createdAt ? new Date(scan.createdAt) : new Date(),
        updatedAt: scan.updatedAt ? new Date(scan.updatedAt) : new Date(),
      })
      .onConflictDoUpdate({
        target: scanRuns.id,
        set: {
          submittedUrl: scan.url ?? scan.normalizedUrl ?? "",
          normalizedUrl: scan.normalizedUrl ?? scan.url ?? "",
          rootUrl: scan.rootUrl ?? null,
          status: scan.status,
          currentStep: scan.currentStep ?? null,
          snapshotHash: scan.snapshotHash ?? null,
          qualityScore: scan.qualityScore ?? null,
          qualityBand: scan.qualityBand ?? null,
          mobileLighthouseScore: scan.lighthouseProfiles.mobile?.score ?? null,
          desktopLighthouseScore: scan.lighthouseProfiles.desktop?.score ?? null,
          lighthouseSource: scan.providerStatus.lighthouse.source,
          lighthouseReason: scan.providerStatus.lighthouse.reason ?? null,
          openaiSource: scan.providerStatus.openai.source,
          openaiReason: scan.providerStatus.openai.reason ?? null,
          openaiModel: scan.providerStatus.openai.model ?? null,
          routeMapJson: artifacts.routeMapJson ?? null,
          pagesJson: artifacts.pagesJson ?? null,
          externalLinksJson: artifacts.externalLinksJson ?? null,
          lighthouseMobileJson: artifacts.lighthouseMobileJson ?? null,
          lighthouseDesktopJson: artifacts.lighthouseDesktopJson ?? null,
          siteUnderstandingJson: artifacts.siteUnderstandingJson ?? null,
          finalPayloadJson: artifacts.finalPayloadJson ?? scan.finalPayload ?? null,
          finalText: scan.fullRoast ?? null,
          previewText: scan.previewRoast ?? null,
          canonicalSummary: artifacts.canonicalSummary ?? null,
          errorMessage: scan.errorMessage ?? null,
          updatedAt: scan.updatedAt ? new Date(scan.updatedAt) : new Date(),
        },
      });
  }

  async appendEvent(event: ScanEvent) {
    await this.db
      .insert(scanEvents)
      .values({
        scanId: event.scanId,
        seq: event.seq,
        eventType: event.eventType,
        stage: event.stage ?? null,
        message: event.message,
        payloadJson: event.payloadJson ? JSON.parse(event.payloadJson) : null,
        createdAt: new Date(event.createdAt),
      })
      .onConflictDoNothing();
  }

  private async loadEvents(scanId: string) {
    const rows = await this.db
      .select()
      .from(scanEvents)
      .where(eq(scanEvents.scanId, scanId))
      .orderBy(scanEvents.seq);

    return rows.map(
      (row) =>
        ({
          scanId: row.scanId,
          seq: row.seq,
          eventType: row.eventType as ScanEvent["eventType"],
          stage: row.stage,
          message: row.message,
          payloadJson: row.payloadJson ? JSON.stringify(row.payloadJson) : null,
          createdAt: row.createdAt.toISOString(),
        }) satisfies ScanEvent,
    );
  }

  private async hydrateScan(row: typeof scanRuns.$inferSelect): Promise<ScanJob> {
    const events = await this.loadEvents(row.id);
    const band = coerceQualityBand(row.qualityBand);
    const lighthouseSource = coerceLighthouseSource(row.lighthouseSource);
    const openAiSource = coerceOpenAiSource(row.openaiSource);

    return scanJobSchema.parse({
      id: row.id,
      persistedRunId: row.id,
      persistedState: "persisted",
      url: row.submittedUrl,
      normalizedUrl: row.normalizedUrl,
      rootUrl: row.rootUrl,
      analysisId: null,
      snapshotHash: row.snapshotHash,
      cacheState: null,
      currentStep: row.currentStep,
      finalResponseState:
        row.status === "COMPLETED"
          ? "COMPLETED"
          : row.status === "FAILED"
            ? "FAILED"
            : "RUNNING",
      status: row.status,
      errorMessage: row.errorMessage,
      previewRoast: row.previewText,
      fullRoast: row.finalText,
      qualityScore: row.qualityScore,
      qualityBand: band,
      providerStatus: {
        lighthouse: {
          provider: "lighthouse",
          source: lighthouseSource,
          reason: row.lighthouseReason,
          latencyMs: null,
        },
        openai: {
          provider: "openai",
          source: openAiSource,
          reason: row.openaiReason,
          model: row.openaiModel,
          latencyMs: null,
        },
      },
      lighthouseProfiles: {
        mobile:
          typeof row.mobileLighthouseScore === "number"
            ? {
                score: row.mobileLighthouseScore,
                band: band ?? "PASSABLE",
                snapshot: {
                  strategy: "mobile",
                  source: lighthouseSource === "local" || lighthouseSource === "pagespeed" ? lighthouseSource : null,
                },
              }
            : null,
        desktop:
          typeof row.desktopLighthouseScore === "number"
            ? {
                score: row.desktopLighthouseScore,
                band: band ?? "PASSABLE",
                snapshot: {
                  strategy: "desktop",
                  source: lighthouseSource === "local" || lighthouseSource === "pagespeed" ? lighthouseSource : null,
                },
              }
            : null,
      },
      siteUnderstanding: parseJson(row.siteUnderstandingJson, null),
      lighthouseInterpretation: null,
      finalPayload: parseJson(row.finalPayloadJson, null),
      canonicalSummary: row.canonicalSummary ?? null,
      findings: [],
      events,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    } satisfies Partial<ScanJob & { canonicalSummary?: string | null }>);
  }

  async getScan(scanId: string) {
    const [row] = await this.db
      .select()
      .from(scanRuns)
      .where(eq(scanRuns.id, scanId))
      .limit(1);

    if (!row) {
      return null;
    }

    return this.hydrateScan(row);
  }

  async getArtifacts(scanId: string): Promise<ScanArtifactsResponse | null> {
    const [row] = await this.db
      .select()
      .from(scanRuns)
      .where(eq(scanRuns.id, scanId))
      .limit(1);

    if (!row) {
      return null;
    }

    const run = await this.hydrateScan(row);
    return {
      run,
      routeMapJson: parseJson<RouteMapSummary | null>(row.routeMapJson, null),
      pagesJson: parseJson<PageContentSnapshot[] | null>(row.pagesJson, null),
      externalLinksJson: parseJson<ExternalLinkSummary[] | null>(row.externalLinksJson, null),
      lighthouseMobileJson: parseJson<Record<string, unknown> | null>(row.lighthouseMobileJson, null),
      lighthouseDesktopJson: parseJson<Record<string, unknown> | null>(row.lighthouseDesktopJson, null),
      siteUnderstandingJson: parseJson<SiteUnderstandingSkillOutput | null>(row.siteUnderstandingJson, null),
      finalPayloadJson: parseJson<FinalRoastPayload | null>(row.finalPayloadJson, null),
      eventLog: run.events,
    };
  }

  async findCompletedBySnapshotHash(snapshotHash: string): Promise<PersistedCompletedRun | null> {
    const [row] = await this.db
      .select()
      .from(scanRuns)
      .where(and(eq(scanRuns.snapshotHash, snapshotHash), eq(scanRuns.status, "COMPLETED")))
      .orderBy(desc(scanRuns.updatedAt))
      .limit(1);

    if (!row) {
      return null;
    }

    const scan = await this.hydrateScan(row);
    if (!scan.finalPayload) {
      return null;
    }

    return {
      scan,
      finalPayload: scan.finalPayload,
      providerStatus: scan.providerStatus,
    };
  }

  async findSimilarCompletedRun(
    normalizedUrl: string,
    snapshotHash: string,
    canonicalSummary: string,
    threshold = 0.8,
  ): Promise<PersistedCompletedRun | null> {
    const rows = await this.db
      .select()
      .from(scanRuns)
      .where(
        and(
          eq(scanRuns.normalizedUrl, normalizedUrl),
          eq(scanRuns.status, "COMPLETED"),
          ne(scanRuns.snapshotHash, snapshotHash),
          sql`${scanRuns.canonicalSummary} IS NOT NULL`,
        ),
      )
      .orderBy(desc(scanRuns.updatedAt))
      .limit(20);

    for (const row of rows) {
      const summary = row.canonicalSummary ?? "";
      const similarity = computeTextSimilarity(canonicalSummary, summary);
      if (similarity >= threshold) {
        const scan = await this.hydrateScan(row);
        if (scan.finalPayload) {
          return {
            scan,
            finalPayload: scan.finalPayload,
            providerStatus: scan.providerStatus,
          };
        }
      }
    }

    return null;
  }

  async clear() {
    await this.db.delete(scanEvents);
    await this.db.delete(scanRuns);
  }
}
