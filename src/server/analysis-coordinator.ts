import { randomUUID } from "node:crypto";

import { analysisCacheStore, scanRunStore } from "@/server/storage";
import type { PersistedAnalysisState } from "@/server/storage/types";

interface ActiveAnalysis {
  state: PersistedAnalysisState;
  attachedScanIds: Set<string>;
  running: boolean;
}

export class AnalysisCoordinator {
  private readonly byAnalysisId = new Map<string, ActiveAnalysis>();
  private readonly bySnapshotHash = new Map<string, string>();

  async attachOrCreate({
    scanId,
    snapshotHash,
    normalizedUrl,
    rootUrl,
    routeMap,
    pages,
    externalLinks,
  }: {
    scanId: string;
    snapshotHash: string;
    normalizedUrl: string;
    rootUrl: string;
    routeMap: PersistedAnalysisState["routeMap"];
    pages: PersistedAnalysisState["pages"];
    externalLinks: PersistedAnalysisState["externalLinks"];
  }) {
    const completedRun = await scanRunStore.findCompletedBySnapshotHash(snapshotHash);
    if (completedRun) {
      return {
        cacheState: "cached" as const,
        completedRun,
      };
    }

    const activeAnalysisId = this.bySnapshotHash.get(snapshotHash);
    if (activeAnalysisId) {
      const active = this.byAnalysisId.get(activeAnalysisId);
      if (active) {
        active.attachedScanIds.add(scanId);
        return {
          cacheState: "attached" as const,
          active,
          shouldStart: !active.running,
        };
      }
    }

    const persisted = await analysisCacheStore.getBySnapshotHash(snapshotHash);
    if (persisted) {
      const active: ActiveAnalysis = {
        state: persisted,
        attachedScanIds: new Set([scanId]),
        running: false,
      };
      this.byAnalysisId.set(persisted.analysisId, active);
      this.bySnapshotHash.set(snapshotHash, persisted.analysisId);
      return {
        cacheState: "resumed" as const,
        active,
        shouldStart: true,
      };
    }

    const analysisId = randomUUID();
    const state: PersistedAnalysisState = {
      analysisId,
      snapshotHash,
      normalizedUrl,
      rootUrl,
      routeMap,
      pages,
      externalLinks,
      status: "RUNNING",
      currentStep: "INITIALIZED",
      finalChunks: [],
      lastFinalText: "",
      logs: [],
    };
    const active: ActiveAnalysis = {
      state,
      attachedScanIds: new Set([scanId]),
      running: false,
    };

    this.byAnalysisId.set(analysisId, active);
    this.bySnapshotHash.set(snapshotHash, analysisId);
    await analysisCacheStore.save(state);

    return {
      cacheState: "fresh" as const,
      active,
      shouldStart: true,
    };
  }

  getAttachedScanIds(analysisId: string) {
    return [...(this.byAnalysisId.get(analysisId)?.attachedScanIds ?? [])];
  }

  getState(analysisId: string) {
    return this.byAnalysisId.get(analysisId)?.state ?? null;
  }

  async updateState(analysisId: string, updater: (state: PersistedAnalysisState) => void) {
    const active = this.byAnalysisId.get(analysisId);
    if (!active) {
      return null;
    }

    updater(active.state);
    await analysisCacheStore.save(active.state);
    return active.state;
  }

  markRunning(analysisId: string, running: boolean) {
    const active = this.byAnalysisId.get(analysisId);
    if (!active) {
      return;
    }

    active.running = running;
  }

  async appendLog(analysisId: string, message: string) {
    const active = this.byAnalysisId.get(analysisId);
    if (!active) {
      return;
    }

    active.state.logs.push(message);
    await analysisCacheStore.appendLog(analysisId, message);
  }

  async detachScan(scanId: string) {
    for (const active of this.byAnalysisId.values()) {
      if (!active.attachedScanIds.has(scanId)) {
        continue;
      }

      active.attachedScanIds.delete(scanId);
      if (active.attachedScanIds.size === 0 && active.state.status === "RUNNING") {
        active.state.status = "PAUSED";
        await analysisCacheStore.save(active.state);
      }

      return active.state;
    }

    return null;
  }

  async completeAnalysis(analysisId: string) {
    const active = this.byAnalysisId.get(analysisId);
    if (!active) {
      return;
    }

    active.state.status = "COMPLETED";
    await analysisCacheStore.save(active.state);
  }

  clear() {
    this.byAnalysisId.clear();
    this.bySnapshotHash.clear();
    return Promise.all([analysisCacheStore.clear(), scanRunStore.clear()]);
  }
}
