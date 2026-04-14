import type {
  FinalRoastPayload,
  ScanFinding,
  ScanJob,
} from "@/lib/shared/scans";
import { qualityBandForScore } from "@/lib/shared/scans";
import { runLighthouseAudit, type LighthouseRunResult } from "@/server/lighthouse";
import { selectPromptPackByScore } from "@/server/pipeline/prompts/score-prompt-packs";
import { buildSemanticSnapshot, computeSnapshotHash } from "@/server/pipeline/steps/build-semantic-snapshot";
import { fetchPrimaryPages } from "@/server/pipeline/steps/fetch-primary-pages";
import { streamFinalSynthesis } from "@/server/pipeline/steps/stream-final-synthesis";
import { runLighthouseInterpretationSkill } from "@/server/pipeline/skills/lighthouse-interpretation-skill";
import { runSiteUnderstandingSkill } from "@/server/pipeline/skills/site-understanding-skill";
import { OpenAiProviderError, streamOpenAiText } from "@/server/providers/openai/client";
import { analysisCoordinator, scanManager } from "@/server/runtime";
import { scanRunStore } from "@/server/storage";
import type { PersistedAnalysisState, PersistedScanArtifacts } from "@/server/storage/types";

interface ScanRuntimeDependencies {
  fetchImpl?: typeof fetch;
  runLighthouse?: (targetUrl: string) => Promise<LighthouseRunResult>;
  streamText?: typeof streamOpenAiText;
}

function previewRoast(text: string) {
  const sentence = text.split(". ").at(0)?.trim() ?? text.trim();
  return sentence.length > 160 ? `${sentence.slice(0, 157)}...` : sentence;
}

function buildFindings(finalPayload: FinalRoastPayload): ScanFinding[] {
  const findings: ScanFinding[] = finalPayload.priorityFixes.map((title, index) => ({
    code: `PRIORITY_FIX_${index + 1}`,
    severity: index === 0 ? "HIGH" : "MEDIUM",
    title,
    roastLine: finalPayload.quickWins0to3Days[index] ?? null,
    fix: finalPayload.quickWins0to3Days[index] ?? null,
  }));

  for (const compliment of finalPayload.compliments) {
    findings.push({
      code: `COMPLIMENT_${findings.length + 1}`,
      severity: "LOW",
      title: compliment,
      roastLine: compliment,
    });
  }

  return findings.slice(0, 4);
}

function buildArtifacts(state: PersistedAnalysisState | null | undefined): PersistedScanArtifacts {
  return {
    routeMapJson: state?.routeMap ?? null,
    pagesJson: state?.pages ?? null,
    externalLinksJson: state?.externalLinks ?? null,
    lighthouseMobileJson: state?.lighthouseRaw?.mobile ?? null,
    lighthouseDesktopJson: state?.lighthouseRaw?.desktop ?? null,
    siteUnderstandingJson: state?.siteUnderstanding ?? null,
    finalPayloadJson: state?.finalPayload ?? null,
  };
}

async function persistScan(scanId: string, state?: PersistedAnalysisState | null) {
  const snapshot = scanManager.getScan(scanId);
  if (!snapshot) {
    return;
  }

  const effectiveState =
    state ?? (snapshot.analysisId ? analysisCoordinator.getState(snapshot.analysisId) : null);
  await scanRunStore.saveScan(snapshot, buildArtifacts(effectiveState));
}

async function appendEventToScans(
  scanIds: string[],
  eventType: Parameters<typeof scanManager.appendEvent>[1],
  stage: string,
  message: string,
  payload?: Parameters<typeof scanManager.appendEvent>[4],
  state?: PersistedAnalysisState | null,
) {
  for (const scanId of scanIds) {
    if (!scanManager.hasScan(scanId)) {
      continue;
    }

    const event = scanManager.appendEvent(scanId, eventType, stage, message, payload);
    await scanRunStore.appendEvent(event);
    await persistScan(scanId, state);
  }
}

async function updateScans(
  scanIds: string[],
  updater: (scan: ScanJob) => void,
  state?: PersistedAnalysisState | null,
) {
  for (const scanId of scanIds) {
    if (!scanManager.hasScan(scanId)) {
      continue;
    }

    scanManager.updateScan(scanId, updater);
    await persistScan(scanId, state);
  }
}

function applyCompletedScan(target: ScanJob, source: ScanJob) {
  target.persistedRunId = source.persistedRunId ?? source.id;
  target.persistedState = source.persistedState ?? "persisted";
  target.rootUrl = source.rootUrl ?? null;
  target.snapshotHash = source.snapshotHash ?? null;
  target.cacheState = "cached";
  target.currentStep = "COMPLETED";
  target.finalResponseState = "COMPLETED";
  target.status = "COMPLETED";
  target.errorMessage = source.errorMessage ?? null;
  target.previewRoast = source.previewRoast ?? null;
  target.fullRoast = source.fullRoast ?? null;
  target.qualityScore = source.qualityScore ?? null;
  target.qualityBand = source.qualityBand ?? null;
  target.providerStatus = structuredClone(source.providerStatus);
  target.lighthouseProfiles = structuredClone(source.lighthouseProfiles);
  target.siteUnderstanding = source.siteUnderstanding ?? null;
  target.lighthouseInterpretation = source.lighthouseInterpretation ?? null;
  target.finalPayload = source.finalPayload ?? null;
  target.findings = structuredClone(source.findings);
}

function failureMessage(error: unknown) {
  return error instanceof Error ? error.message : "Scan failed";
}

export async function runScanJob(scanId: string, deps: ScanRuntimeDependencies = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const runLighthouse = deps.runLighthouse ?? runLighthouseAudit;
  const streamText = deps.streamText ?? streamOpenAiText;

  await scanManager.runScan(scanId, async ({ appendEvent, getScan, updateScan }) => {
    const initialScan = getScan();
    const persistenceReason = scanRunStore.mode === "unavailable" ? scanRunStore.reason : null;

    if (persistenceReason) {
      updateScan((entry) => {
        entry.persistedState = "unavailable";
        entry.persistedRunId = null;
        entry.currentStep = "PERSISTENCE_FAILED";
        entry.errorMessage = persistenceReason;
      });
      appendEvent("SCAN_STAGE", "PERSISTENCE", `POSTGRES(unavailable) · ${persistenceReason}`, {
        flushStream: true,
      });
      appendEvent("JOB_FAILED", "FAILED", `SCAN FAILED · ${persistenceReason}`, {
        error: persistenceReason,
        flushStream: true,
      });
      return;
    }

    updateScan((entry) => {
      entry.persistedRunId = entry.id;
      entry.persistedState = "persisted";
    });
    await persistScan(scanId);

    const startedEvent = appendEvent("SCAN_STAGE", "RUNNING", "Scan started");
    await scanRunStore.appendEvent(startedEvent);
    await persistScan(scanId);

    const routeMapEvent = appendEvent("SCAN_STAGE", "ROUTE_MAP", "Building route map");
    await scanRunStore.appendEvent(routeMapEvent);

    const crawl = await fetchPrimaryPages(initialScan.normalizedUrl ?? initialScan.url ?? "", fetchImpl);
    const snapshot = buildSemanticSnapshot(crawl.rootUrl, crawl.pages);
    const snapshotHash = computeSnapshotHash(snapshot);

    updateScan((entry) => {
      entry.rootUrl = crawl.rootUrl;
      entry.snapshotHash = snapshotHash;
      entry.currentStep = "SNAPSHOT_READY";
    });
    await persistScan(scanId, {
      analysisId: "",
      snapshotHash,
      normalizedUrl: snapshot.normalizedUrl,
      rootUrl: crawl.rootUrl,
      routeMap: crawl.routeMap,
      pages: crawl.pages,
      externalLinks: crawl.externalLinks,
      status: "RUNNING",
      currentStep: "SNAPSHOT_READY",
      finalChunks: [],
      lastFinalText: "",
      logs: [],
    });

    for (const page of crawl.pages) {
      const event = appendEvent("PAGE_SCANNED", "CRAWLING", "Page scanned", {
        url: page.url,
        pageKind: page.pageKind,
        statusCode: page.statusCode,
        ok: page.ok,
      });
      await scanRunStore.appendEvent(event);
    }

    const attached = await analysisCoordinator.attachOrCreate({
      scanId,
      snapshotHash,
      normalizedUrl: snapshot.normalizedUrl,
      rootUrl: crawl.rootUrl,
      routeMap: crawl.routeMap,
      pages: crawl.pages,
      externalLinks: crawl.externalLinks,
    });

    if ("completedRun" in attached && attached.completedRun) {
      const cacheEvent = appendEvent("SCAN_STAGE", "CACHE", "Using cached analysis", {
        flushStream: true,
      });
      await scanRunStore.appendEvent(cacheEvent);
      updateScan((entry) => {
        applyCompletedScan(entry, attached.completedRun.scan);
      });
      await persistScan(scanId);
      const doneEvent = appendEvent("JOB_COMPLETED", "COMPLETED", "Scan completed");
      await scanRunStore.appendEvent(doneEvent);
      return;
    }

    const active = attached.active;
    const analysisId = active.state.analysisId;
    updateScan((entry) => {
      entry.analysisId = analysisId;
      entry.cacheState = attached.cacheState;
      entry.currentStep = active.state.currentStep;
    });
    await persistScan(scanId, active.state);

    if (!attached.shouldStart) {
      const attachedEvent = appendEvent("SCAN_STAGE", "ATTACHED", "Attached to shared analysis", {
        flushStream: true,
      });
      await scanRunStore.appendEvent(attachedEvent);
      updateScan((entry) => {
        entry.status = "RUNNING";
      });
      await persistScan(scanId, active.state);
      return;
    }

    analysisCoordinator.markRunning(analysisId, true);

    try {
      await analysisCoordinator.updateState(analysisId, (state) => {
        state.currentStep = "PAGES_FETCHED";
        state.status = "RUNNING";
      });

      let state = analysisCoordinator.getState(analysisId);

      if (!state?.lighthouseProfiles?.mobile || !state?.lighthouseProfiles?.desktop) {
        await appendEventToScans(
          analysisCoordinator.getAttachedScanIds(analysisId),
          "SCAN_STAGE",
          "QUALITY",
          `LIGHTHOUSE(${initialScan.providerStatus?.lighthouse.source ?? "local"}) · Running mobile profile`,
          { flushStream: true },
        );
        await appendEventToScans(
          analysisCoordinator.getAttachedScanIds(analysisId),
          "SCAN_STAGE",
          "QUALITY",
          `LIGHTHOUSE(${initialScan.providerStatus?.lighthouse.source ?? "local"}) · Running desktop profile`,
          { flushStream: false },
        );

        const lighthouse = await runLighthouse(snapshot.normalizedUrl);
        state = await analysisCoordinator.updateState(analysisId, (entry) => {
          entry.currentStep = "LIGHTHOUSE_DONE";
          entry.lighthouseProfiles = lighthouse.profiles;
          entry.lighthouseRaw = lighthouse.raw;
          entry.status = "RUNNING";
        });

        await updateScans(
          analysisCoordinator.getAttachedScanIds(analysisId),
          (entry) => {
            entry.currentStep = "LIGHTHOUSE_DONE";
            entry.qualityScore = lighthouse.qualityScore;
            entry.qualityBand = lighthouse.qualityBand;
            entry.lighthouseProfiles = lighthouse.profiles;
            entry.providerStatus.lighthouse = lighthouse.status;
          },
          state,
        );

        await appendEventToScans(
          analysisCoordinator.getAttachedScanIds(analysisId),
          "SCAN_STAGE",
          "QUALITY",
          `LIGHTHOUSE(${lighthouse.status.source}) · Mobile ${lighthouse.profiles.mobile?.score ?? "n/a"}, Desktop ${lighthouse.profiles.desktop?.score ?? "n/a"}, Combined ${lighthouse.qualityScore}`,
          { flushStream: true },
        );
      }

      state = analysisCoordinator.getState(analysisId);
      const qualityScore =
        state?.lighthouseProfiles?.mobile && state.lighthouseProfiles.desktop
          ? Math.round(
              (state.lighthouseProfiles.mobile.score + state.lighthouseProfiles.desktop.score) / 2,
            )
          : 0;

      if (!state?.siteUnderstanding) {
        await appendEventToScans(
          analysisCoordinator.getAttachedScanIds(analysisId),
          "SCAN_STAGE",
          "SITE_SKILL",
          "Summarizing site offer and audience",
          { flushStream: true },
        );
        const siteSkill = await runSiteUnderstandingSkill(snapshot, state?.lighthouseProfiles ?? {
          mobile: null,
          desktop: null,
        });
        state = await analysisCoordinator.updateState(analysisId, (entry) => {
          entry.currentStep = "SITE_UNDERSTANDING_DONE";
          entry.siteUnderstanding = siteSkill.output;
        });
        await updateScans(
          analysisCoordinator.getAttachedScanIds(analysisId),
          (entry) => {
            entry.currentStep = "SITE_UNDERSTANDING_DONE";
            entry.siteUnderstanding = siteSkill.output;
          },
          state,
        );
      }

      if (!state?.lighthouseInterpretation) {
        await appendEventToScans(
          analysisCoordinator.getAttachedScanIds(analysisId),
          "SCAN_STAGE",
          "LIGHTHOUSE_SKILL",
          "Translating Lighthouse into conversion risk",
          { flushStream: true },
        );
        const interpretation = await runLighthouseInterpretationSkill(
          qualityScore,
          state?.lighthouseProfiles ?? {
            mobile: null,
            desktop: null,
          },
        );
        state = await analysisCoordinator.updateState(analysisId, (entry) => {
          entry.currentStep = "LIGHTHOUSE_INTERPRETATION_DONE";
          entry.lighthouseInterpretation = interpretation.output;
        });
        await updateScans(
          analysisCoordinator.getAttachedScanIds(analysisId),
          (entry) => {
            entry.currentStep = "LIGHTHOUSE_INTERPRETATION_DONE";
            entry.lighthouseInterpretation = interpretation.output;
          },
          state,
        );
      }

      const promptPack = selectPromptPackByScore(qualityScore);
      state = await analysisCoordinator.updateState(analysisId, (entry) => {
        entry.promptPackId = promptPack.id;
        entry.currentStep = "PROMPT_PACK_SELECTED";
      });
      await updateScans(
        analysisCoordinator.getAttachedScanIds(analysisId),
        (entry) => {
          entry.currentStep = "PROMPT_PACK_SELECTED";
        },
        state,
      );

      await appendEventToScans(
        analysisCoordinator.getAttachedScanIds(analysisId),
        "SCAN_STAGE",
        "FINAL_SYNTHESIS",
        `OPENAI(${process.env.OPENAI_API_KEY ? "live" : "disabled"}) · Writing final roast`,
        { flushStream: true },
      );

      const siteUnderstanding = state?.siteUnderstanding;
      const lighthouseInterpretation = state?.lighthouseInterpretation;
      if (!siteUnderstanding || !lighthouseInterpretation) {
        throw new Error("Missing required analysis state for final synthesis");
      }

      const synthesis = await streamFinalSynthesis({
        snapshotHash,
        promptPack,
        snapshot,
        siteUnderstanding,
        lighthouseInterpretation,
        onText: async (chunk) => {
          const updated = await analysisCoordinator.updateState(analysisId, (entry) => {
            entry.currentStep = "FINAL_SYNTHESIS_STREAMING";
            entry.finalChunks.push(chunk);
            entry.lastFinalText = `${entry.lastFinalText}${chunk}`;
          });

          await appendEventToScans(
            analysisCoordinator.getAttachedScanIds(analysisId),
            "LLM_CHUNK",
            "FINAL_SYNTHESIS",
            "Streaming final roast",
            {
              textDelta: chunk,
              field: "finalText",
            },
          );

          await updateScans(
            analysisCoordinator.getAttachedScanIds(analysisId),
            (entry) => {
              entry.currentStep = "FINAL_SYNTHESIS_STREAMING";
            },
            updated,
          );
        },
        streamText,
      });

      const finalPayload = synthesis.payload;
      const findings = buildFindings(finalPayload);

      state = await analysisCoordinator.updateState(analysisId, (entry) => {
        entry.currentStep = "FINAL_SYNTHESIS_DONE";
        entry.mergedPrompt = synthesis.mergedPrompt;
        entry.finalPayload = finalPayload;
        entry.lastFinalText = finalPayload.finalText;
        entry.status = "COMPLETED";
      });

      await updateScans(
        analysisCoordinator.getAttachedScanIds(analysisId),
        (entry) => {
          entry.currentStep = "COMPLETED";
          entry.previewRoast = previewRoast(finalPayload.finalText);
          entry.fullRoast = finalPayload.finalText;
          entry.finalPayload = finalPayload;
          entry.finalResponseState = "COMPLETED";
          entry.qualityScore = qualityScore;
          entry.qualityBand = qualityBandForScore(qualityScore);
          entry.findings = findings;
          entry.providerStatus.openai = synthesis.status;
        },
        state,
      );

      await appendEventToScans(
        analysisCoordinator.getAttachedScanIds(analysisId),
        "FINDINGS_READY",
        "PERSIST_FINDINGS",
        "Findings persisted",
        { count: findings.length, flushStream: true },
      );

      await analysisCoordinator.completeAnalysis(analysisId);

      await appendEventToScans(
        analysisCoordinator.getAttachedScanIds(analysisId),
        "JOB_COMPLETED",
        "COMPLETED",
        "Scan completed",
      );
    } catch (error) {
      const message = failureMessage(error);
      const updated = await analysisCoordinator.updateState(analysisId, (state) => {
        state.status = "FAILED";
        state.currentStep = "FAILED";
      });

      await updateScans(
        analysisCoordinator.getAttachedScanIds(analysisId),
        (entry) => {
          entry.currentStep = "FAILED";
          entry.errorMessage = message;
          entry.finalResponseState = "FAILED";

          if (error instanceof OpenAiProviderError) {
            entry.providerStatus.openai = error.status;
          }

          if (error instanceof Error && "status" in error) {
            const statusCarrier = error as Error & {
              status?: ScanJob["providerStatus"]["lighthouse"];
            };
            if (statusCarrier.status?.provider === "lighthouse") {
              entry.providerStatus.lighthouse = statusCarrier.status;
            }
          }
        },
        updated,
      );

      await appendEventToScans(
        analysisCoordinator.getAttachedScanIds(analysisId),
        "JOB_FAILED",
        "FAILED",
        `SCAN FAILED · ${message}`,
        { error: message, flushStream: true },
      );
    } finally {
      analysisCoordinator.markRunning(analysisId, false);
    }
  });
}
