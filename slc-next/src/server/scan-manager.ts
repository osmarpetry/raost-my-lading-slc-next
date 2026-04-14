import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

import type {
  ParsedScanEventPayload,
  ScanEvent,
  ScanEventType,
  ScanJob,
  StartScanResult,
} from "@/lib/shared/scans";

interface CreateScanInput {
  url: string;
  normalizedUrl: string;
  clientSessionId?: string;
}

export interface ScanExecutionContext {
  getScan(): ScanJob;
  updateScan(updater: (scan: ScanJob) => void): ScanJob;
  appendEvent(
    eventType: ScanEventType,
    stage: string,
    message: string,
    payload?: ParsedScanEventPayload,
  ): ScanEvent;
}

type MutableScanJob = ScanJob & {
  createdAt: string;
  updatedAt: string;
};

function cloneScan(scan: MutableScanJob): ScanJob {
  return structuredClone(scan);
}

export class ScanManager {
  private readonly emitter = new EventEmitter();
  private readonly scans = new Map<string, MutableScanJob>();
  private readonly activeScans = new Set<string>();

  hasScan(scanId: string) {
    return this.scans.has(scanId);
  }

  startScan(input: CreateScanInput): StartScanResult {
    const now = new Date().toISOString();
    const scanId = randomUUID();
    const scan: MutableScanJob = {
      id: scanId,
      persistedRunId: null,
      persistedState: "pending",
      url: input.url,
      normalizedUrl: input.normalizedUrl,
      rootUrl: null,
      clientSessionId: input.clientSessionId,
      status: "QUEUED",
      errorMessage: null,
      previewRoast: null,
      fullRoast: null,
      finalPayload: null,
      finalResponseState: "RUNNING",
      analysisId: null,
      snapshotHash: null,
      cacheState: null,
      currentStep: "QUEUED",
      providerStatus: {
        lighthouse: {
          provider: "lighthouse",
          source: "disabled",
          reason: "Lighthouse not started",
          latencyMs: null,
        },
        openai: {
          provider: "openai",
          source: "disabled",
          reason: "OpenAI not started",
          model: null,
          latencyMs: null,
        },
      },
      siteUnderstanding: null,
      lighthouseInterpretation: null,
      qualityScore: null,
      qualityBand: null,
      lighthouseProfiles: {
        mobile: null,
        desktop: null,
      },
      findings: [],
      events: [],
      createdAt: now,
      updatedAt: now,
    };

    this.scans.set(scanId, scan);
    this.appendEvent(scanId, "SCAN_STAGE", "QUEUED", "Scan queued", {
      url: input.normalizedUrl,
    });

    return {
      scanId,
      status: scan.status,
      scan: {
        id: scanId,
        normalizedUrl: input.normalizedUrl,
        status: scan.status,
      },
    };
  }

  getScan(scanId: string) {
    const scan = this.scans.get(scanId);
    return scan ? cloneScan(scan) : undefined;
  }

  updateScan(
    scanId: string,
    updater: (scan: MutableScanJob) => void,
  ): ScanJob {
    const scan = this.requireScan(scanId);
    updater(scan);
    scan.updatedAt = new Date().toISOString();
    return cloneScan(scan);
  }

  appendEvent(
    scanId: string,
    eventType: ScanEventType,
    stage: string,
    message: string,
    payload?: ParsedScanEventPayload,
  ) {
    const scan = this.requireScan(scanId);
    const createdAt = new Date().toISOString();

    if (
      eventType !== "JOB_COMPLETED" &&
      eventType !== "JOB_FAILED" &&
      eventType !== "JOB_CANCELLED" &&
      scan.status === "QUEUED" &&
      stage !== "QUEUED"
    ) {
      scan.status = "RUNNING";
    }

    if (eventType === "JOB_COMPLETED") {
      scan.status = "COMPLETED";
      scan.finalResponseState = "COMPLETED";
    }

    if (eventType === "JOB_FAILED" || eventType === "JOB_CANCELLED") {
      scan.status = "FAILED";
      scan.errorMessage = message;
      scan.finalResponseState = "FAILED";
    }

    const event: ScanEvent = {
      scanId,
      seq: scan.events.length + 1,
      eventType,
      stage,
      message,
      payloadJson: payload ? JSON.stringify(payload) : null,
      createdAt,
    };

    scan.events.push(event);
    scan.updatedAt = createdAt;

    this.emitter.emit("scan:event", cloneScan(scan), event);

    if (eventType === "JOB_FAILED" || eventType === "JOB_CANCELLED") {
      this.emitter.emit("scan:error", cloneScan(scan), message);
    }

    return event;
  }

  async runScan(
    scanId: string,
    runner: (context: ScanExecutionContext) => Promise<void>,
  ) {
    if (this.activeScans.has(scanId)) {
      return;
    }

    this.activeScans.add(scanId);

    try {
      await runner({
        getScan: () => this.getRequiredSnapshot(scanId),
        updateScan: (updater) => this.updateScan(scanId, updater),
        appendEvent: (eventType, stage, message, payload) =>
          this.appendEvent(scanId, eventType, stage, message, payload),
      });
    } catch (error) {
      if (!this.hasScan(scanId)) {
        return;
      }

      const message = error instanceof Error ? error.message : "Scan failed";
      this.updateScan(scanId, (scan) => {
        scan.errorMessage = message;
      });
      this.appendEvent(scanId, "JOB_FAILED", "FAILED", "Scan failed", {
        error: message,
      });
    } finally {
      this.activeScans.delete(scanId);
    }
  }

  onScanEvent(listener: (scan: ScanJob, event: ScanEvent) => void) {
    this.emitter.on("scan:event", listener);
    return () => this.emitter.off("scan:event", listener);
  }

  onScanError(listener: (scan: ScanJob, message: string) => void) {
    this.emitter.on("scan:error", listener);
    return () => this.emitter.off("scan:error", listener);
  }

  clear() {
    this.scans.clear();
    this.activeScans.clear();
  }

  cancelScan(scanId: string, message = "Scan cancelled") {
    if (!this.scans.has(scanId)) {
      return undefined;
    }

    this.updateScan(scanId, (scan) => {
      scan.errorMessage = message;
      scan.finalResponseState = "PAUSED";
    });
    return this.appendEvent(scanId, "JOB_CANCELLED", "CANCELLED", message, {
      error: message,
    });
  }

  private requireScan(scanId: string) {
    const scan = this.scans.get(scanId);
    if (!scan) {
      throw new Error("Scan not found");
    }

    return scan;
  }

  private getRequiredSnapshot(scanId: string) {
    const scan = this.requireScan(scanId);
    return cloneScan(scan);
  }
}
