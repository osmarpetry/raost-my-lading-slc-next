import { z } from "zod";

export const scanEventTypes = [
  "SCAN_STAGE",
  "PAGE_SCANNED",
  "EXTERNAL_LINK_CHECKED",
  "LLM_CHUNK",
  "FINDINGS_READY",
  "JOB_COMPLETED",
  "JOB_FAILED",
  "JOB_CANCELLED",
] as const;

export type ScanEventType = (typeof scanEventTypes)[number];
export type TransportState = "connecting" | "ready" | "closed" | "error";
export type ScanState = "idle" | "submitting" | "streaming" | "completed" | "failed";
export type TerminalChannel = "system" | "ws" | "http" | "scan" | "ollama" | "error" | "prompt";
export type TerminalTone = "info" | "muted" | "success" | "error";
export type QualityBand = "EXCELLENT" | "STRONG" | "PASSABLE" | "WEAK" | "BROKEN";

export interface ScanEvent {
  scanId: string;
  seq: number;
  eventType: ScanEventType;
  stage?: string | null;
  message: string;
  payloadJson?: string | null;
  createdAt: string;
}

export interface ParsedScanEventPayload extends Record<string, unknown> {
  chunk?: string;
  textDelta?: string;
  field?: string;
  step?: string;
  band?: string;
  flushStream?: boolean;
  url?: string;
  pageKind?: string;
  loaded?: boolean;
  count?: number;
  error?: string;
}

export interface LighthouseSnapshot {
  performance?: number | null;
  accessibility?: number | null;
  bestPractices?: number | null;
  seo?: number | null;
}

export interface ScanFinding {
  code: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  problem?: string | null;
  why?: string | null;
  fix?: string | null;
  impact?: string | null;
  roastLine?: string | null;
}

export interface ScanJob {
  id: string;
  url?: string;
  normalizedUrl?: string;
  status: string;
  errorMessage?: string | null;
  previewRoast?: string | null;
  fullRoast?: string | null;
  qualityScore?: number | null;
  qualityBand?: QualityBand | null;
  lighthouse?: LighthouseSnapshot | null;
  findings: ScanFinding[];
  events: ScanEvent[];
  createdAt?: string;
  updatedAt?: string;
}

export interface StartScanResult {
  scanId: string;
  status: string;
  scan: {
    id: string;
    normalizedUrl: string;
    status: string;
  };
}

export interface ScanTransportError {
  scanId?: string;
  message: string;
}

export interface ClientToServerEvents {
  "scan:subscribe": (payload: ScanSubscription) => void;
  "scan:unsubscribe": (payload: ScanSubscription) => void;
}

export interface ServerToClientEvents {
  "scan:event": (event: ScanEvent) => void;
  "scan:snapshot": (snapshot: ScanJob) => void;
  "scan:error": (error: ScanTransportError) => void;
}

export interface TerminalLine {
  id: string;
  channel: TerminalChannel;
  prefix?: string;
  text: string;
  tone: TerminalTone;
  streaming?: boolean;
  prompt?: boolean;
}

export type TerminalLineSeed = Omit<TerminalLine, "id">;

export interface TerminalState {
  lines: TerminalLine[];
  activeStreamLineId: string | null;
  hadOllamaStream: boolean;
}

export interface ScanEventRender {
  lines: TerminalLineSeed[];
  ollamaChunk?: string;
  flushStream: boolean;
  nextScanState?: Extract<ScanState, "completed" | "failed">;
}

export const scanEventSchema = z.object({
  scanId: z.string().uuid(),
  seq: z.number().int().positive(),
  eventType: z.enum(scanEventTypes),
  stage: z.string().nullable().optional(),
  message: z.string().min(1),
  payloadJson: z.string().nullable().optional(),
  createdAt: z.string().min(1),
});

export const scanFindingSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  title: z.string().min(1),
  problem: z.string().nullable().optional(),
  why: z.string().nullable().optional(),
  fix: z.string().nullable().optional(),
  impact: z.string().nullable().optional(),
  roastLine: z.string().nullable().optional(),
});

export const scanJobSchema = z.object({
  id: z.string().uuid(),
  url: z.string().optional(),
  normalizedUrl: z.string().optional(),
  status: z.string().min(1),
  errorMessage: z.string().nullable().optional(),
  previewRoast: z.string().nullable().optional(),
  fullRoast: z.string().nullable().optional(),
  qualityScore: z.number().nullable().optional(),
  qualityBand: z.enum(["EXCELLENT", "STRONG", "PASSABLE", "WEAK", "BROKEN"]).nullable().optional(),
  lighthouse: z
    .object({
      performance: z.number().nullable().optional(),
      accessibility: z.number().nullable().optional(),
      bestPractices: z.number().nullable().optional(),
      seo: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
  findings: z.array(scanFindingSchema),
  events: z.array(scanEventSchema),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const startScanRequestSchema = z.object({
  url: z.string().min(1),
});

export const startScanResultSchema = z.object({
  scanId: z.string().uuid(),
  status: z.string().min(1),
  scan: z.object({
    id: z.string().uuid(),
    normalizedUrl: z.string().min(1),
    status: z.string().min(1),
  }),
});

export const scanSubscriptionSchema = z.object({
  scanId: z.string().uuid(),
});

export type ScanSubscription = z.infer<typeof scanSubscriptionSchema>;

export function applyScanEvent(scan: ScanJob | null, event: ScanEvent): ScanJob | null {
  if (!scan || scan.id !== event.scanId) {
    return scan;
  }

  if (scan.events.some((entry) => entry.seq === event.seq)) {
    return scan;
  }

  const events = [...scan.events, event].sort((left, right) => left.seq - right.seq);
  let status = scan.status;
  let errorMessage = scan.errorMessage ?? null;

  if (event.eventType === "JOB_COMPLETED") {
    status = "COMPLETED";
  }

  if (event.eventType === "JOB_FAILED" || event.eventType === "JOB_CANCELLED") {
    status = "FAILED";
    errorMessage = event.message;
  }

  if (scan.status === "QUEUED" && event.stage !== "QUEUED") {
    status = "RUNNING";
  }

  return {
    ...scan,
    status,
    errorMessage,
    updatedAt: event.createdAt,
    events,
  };
}

export function qualityBandForScore(score: number): QualityBand {
  if (score >= 90) {
    return "EXCELLENT";
  }

  if (score >= 75) {
    return "STRONG";
  }

  if (score >= 60) {
    return "PASSABLE";
  }

  if (score >= 40) {
    return "WEAK";
  }

  return "BROKEN";
}
