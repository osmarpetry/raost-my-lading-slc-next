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
export type TerminalChannel = "system" | "ws" | "http" | "scan" | "model" | "error" | "prompt";
export type TerminalTone = "info" | "muted" | "success" | "error";
export type QualityBand = "EXCELLENT" | "STRONG" | "PASSABLE" | "WEAK" | "BROKEN";
export type CacheState = "fresh" | "attached" | "resumed" | "cached";
export type AnalysisStatus = "RUNNING" | "PAUSED" | "PARTIAL" | "COMPLETED" | "FAILED";
export type FinalResponseState = "RUNNING" | "PARTIAL" | "COMPLETED" | "FAILED" | "PAUSED";
export type PersistedState = "pending" | "persisted" | "unavailable";
export type SiteType =
  | "PORTFOLIO"
  | "SAAS"
  | "MARKETPLACE"
  | "RECRUITMENT_PLATFORM"
  | "AGENCY"
  | "CONSULTING"
  | "CONTENT"
  | "OTHER";
export type LikelyConversionGoal =
  | "CONTACT"
  | "BOOK_CALL"
  | "START_TRIAL"
  | "SIGN_UP"
  | "APPLY"
  | "HIRE"
  | "READ_MORE"
  | "OTHER";
export type ScorePromptTone = "brutal" | "direct" | "sharp" | "polished";
export type PromptUrgency = "critical" | "high" | "medium" | "low";
export type LighthouseProviderSource = "local" | "pagespeed" | "disabled" | "failed";
export type OpenAiProviderSource = "live" | "disabled" | "failed";

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

export interface LighthouseProviderStatus {
  provider: "lighthouse";
  source: LighthouseProviderSource;
  reason?: string | null;
  latencyMs?: number | null;
}

export interface OpenAiProviderStatus {
  provider: "openai";
  source: OpenAiProviderSource;
  reason?: string | null;
  model?: string | null;
  latencyMs?: number | null;
}

export interface ProviderStatus {
  lighthouse: LighthouseProviderStatus;
  openai: OpenAiProviderStatus;
}

export interface LighthouseSnapshot {
  performance?: number | null;
  accessibility?: number | null;
  bestPractices?: number | null;
  seo?: number | null;
  strategy?: "mobile" | "desktop" | null;
  source?: "local" | "pagespeed" | null;
  fetchedAt?: string | null;
}

export interface LighthouseProfile {
  score: number;
  band: QualityBand;
  snapshot: LighthouseSnapshot;
}

export interface LighthouseProfiles {
  mobile: LighthouseProfile | null;
  desktop: LighthouseProfile | null;
}

export interface LighthouseInterpretationSkillOutput {
  scoreBandId: string;
  severity: "EXTREME" | "HIGH" | "MEDIUM" | "LOW";
  summary: string;
  conversionRisk: string;
  topPerformanceNarratives: string[];
  quickFixIdeas: string[];
}

export interface SiteUnderstandingSkillOutput {
  siteType: SiteType;
  primaryOffer: string;
  secondaryOffers: string[];
  targetAudience: string[];
  userIntent: string;
  brandVoice: string;
  coreTopics: string[];
  evidencePresent: string[];
  evidenceMissing: string[];
  likelyConversionGoal: LikelyConversionGoal;
  businessUnderstandingScore: number;
  clarityScore: number;
  trustScore: number;
  seoMessageFitScore: number;
  compliments: [string, string, string];
  priorityFixes: [string, string, string];
  quickWins0to3Days: string[];
  summary: string;
  confidence: number;
  lowConfidence?: boolean;
}

export interface PromptPack {
  id: string;
  minScore: number;
  maxScore: number;
  tone: ScorePromptTone;
  urgency: PromptUrgency;
  focusWeights: {
    clarity: number;
    trust: number;
    proof: number;
    speed: number;
    seo: number;
  };
  fixedInstructionBlock: string;
  forbiddenMoves: string[];
}

export interface FinalRoastPayload {
  headlineDiagnosis: string;
  whatSiteSells: string;
  whoItTargets: string[];
  compliments: [string, string, string];
  priorityFixes: [string, string, string];
  quickWins0to3Days: string[];
  finalRoast: string;
  confidence: number;
  usedSnapshotHash: string;
  usedPromptPackId: string;
  usedSources: string[];
  finalText: string;
}

export interface ExternalLinkSummary {
  sourceUrl: string;
  targetUrl: string;
  label: string | null;
}

export interface RouteMapSummary {
  rootUrl: string;
  scannedUrls: string[];
  childUrls: string[];
}

export interface PageContentSnapshot {
  url: string;
  pageKind: "HOMEPAGE" | "INTERNAL";
  statusCode: number;
  ok: boolean;
  contentType: string | null;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  headings: string[];
  heroText: string | null;
  ctaTexts: string[];
  proofBlocks: string[];
  pricingBlocks: string[];
  testimonials: string[];
  navLabels: string[];
  footerTrustItems: string[];
  externalLinks: ExternalLinkSummary[];
  snippet: string | null;
  text: string;
}

export interface SemanticSnapshot {
  normalizedUrl: string;
  selectedPages: PageContentSnapshot[];
  canonicalText: string;
  canonicalSummary: string;
  hero: string | null;
  mainCta: string | null;
  proofSummary: string | null;
  pagesSummary: string;
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
  persistedRunId?: string | null;
  persistedState?: PersistedState | null;
  url?: string;
  normalizedUrl?: string;
  rootUrl?: string | null;
  clientSessionId?: string;
  analysisId?: string | null;
  snapshotHash?: string | null;
  cacheState?: CacheState | null;
  currentStep?: string | null;
  finalResponseState?: FinalResponseState | null;
  status: string;
  errorMessage?: string | null;
  previewRoast?: string | null;
  fullRoast?: string | null;
  qualityScore?: number | null;
  qualityBand?: QualityBand | null;
  providerStatus: ProviderStatus;
  lighthouseProfiles: LighthouseProfiles;
  siteUnderstanding?: SiteUnderstandingSkillOutput | null;
  lighthouseInterpretation?: LighthouseInterpretationSkillOutput | null;
  finalPayload?: FinalRoastPayload | null;
  findings: ScanFinding[];
  events: ScanEvent[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AnalysisCheckpoint {
  analysisId: string;
  snapshotHash: string;
  normalizedUrl: string;
  rootUrl: string;
  routeMap: RouteMapSummary;
  pages: PageContentSnapshot[];
  externalLinks: ExternalLinkSummary[];
  status: AnalysisStatus;
  currentStep: string;
  lighthouseProfiles?: LighthouseProfiles;
  lighthouseRaw?: {
    mobile: Record<string, unknown> | null;
    desktop: Record<string, unknown> | null;
  };
  lighthouseInterpretation?: LighthouseInterpretationSkillOutput;
  siteUnderstanding?: SiteUnderstandingSkillOutput;
  promptPackId?: string;
  mergedPrompt?: string;
  finalChunks: string[];
  lastFinalText: string;
  finalPayload?: FinalRoastPayload | null;
  logs: string[];
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
  hadModelStream: boolean;
}

export interface ScanEventRender {
  lines: TerminalLineSeed[];
  modelChunk?: string;
  flushStream: boolean;
  nextScanState?: Extract<ScanState, "completed" | "failed">;
}

export interface ScanArtifactsResponse {
  run: ScanJob;
  routeMapJson: RouteMapSummary | null;
  pagesJson: PageContentSnapshot[] | null;
  externalLinksJson: ExternalLinkSummary[] | null;
  lighthouseMobileJson: Record<string, unknown> | null;
  lighthouseDesktopJson: Record<string, unknown> | null;
  siteUnderstandingJson: SiteUnderstandingSkillOutput | null;
  finalPayloadJson: FinalRoastPayload | null;
  eventLog: ScanEvent[];
}

const lighthouseProviderStatusSchema = z.object({
  provider: z.literal("lighthouse"),
  source: z.enum(["local", "pagespeed", "disabled", "failed"]),
  reason: z.string().nullable().optional(),
  latencyMs: z.number().nullable().optional(),
});

const openAiProviderStatusSchema = z.object({
  provider: z.literal("openai"),
  source: z.enum(["live", "disabled", "failed"]),
  reason: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  latencyMs: z.number().nullable().optional(),
});

const providerStatusSchema = z.object({
  lighthouse: lighthouseProviderStatusSchema,
  openai: openAiProviderStatusSchema,
});

const lighthouseSnapshotSchema = z.object({
  performance: z.number().nullable().optional(),
  accessibility: z.number().nullable().optional(),
  bestPractices: z.number().nullable().optional(),
  seo: z.number().nullable().optional(),
  strategy: z.enum(["mobile", "desktop"]).nullable().optional(),
  source: z.enum(["local", "pagespeed"]).nullable().optional(),
  fetchedAt: z.string().nullable().optional(),
});

const lighthouseProfileSchema = z.object({
  score: z.number().min(0).max(100),
  band: z.enum(["EXCELLENT", "STRONG", "PASSABLE", "WEAK", "BROKEN"]),
  snapshot: lighthouseSnapshotSchema,
});

const externalLinkSummarySchema = z.object({
  sourceUrl: z.string().min(1),
  targetUrl: z.string().min(1),
  label: z.string().nullable(),
});

const routeMapSummarySchema = z.object({
  rootUrl: z.string().min(1),
  scannedUrls: z.array(z.string().min(1)),
  childUrls: z.array(z.string().min(1)),
});

export const finalRoastPayloadSchema = z.object({
  headlineDiagnosis: z.string().min(1),
  whatSiteSells: z.string().min(1),
  whoItTargets: z.array(z.string().min(1)),
  compliments: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
  priorityFixes: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
  quickWins0to3Days: z.array(z.string().min(1)).max(3),
  finalRoast: z.string().min(1),
  confidence: z.number().min(0).max(1),
  usedSnapshotHash: z.string().min(1),
  usedPromptPackId: z.string().min(1),
  usedSources: z.array(z.string().min(1)),
  finalText: z.string().min(1),
});

export const siteUnderstandingSkillOutputSchema = z.object({
  siteType: z.enum([
    "PORTFOLIO",
    "SAAS",
    "MARKETPLACE",
    "RECRUITMENT_PLATFORM",
    "AGENCY",
    "CONSULTING",
    "CONTENT",
    "OTHER",
  ]),
  primaryOffer: z.string().min(1),
  secondaryOffers: z.array(z.string().min(1)),
  targetAudience: z.array(z.string().min(1)),
  userIntent: z.string().min(1),
  brandVoice: z.string().min(1),
  coreTopics: z.array(z.string().min(1)),
  evidencePresent: z.array(z.string().min(1)),
  evidenceMissing: z.array(z.string().min(1)),
  likelyConversionGoal: z.enum([
    "CONTACT",
    "BOOK_CALL",
    "START_TRIAL",
    "SIGN_UP",
    "APPLY",
    "HIRE",
    "READ_MORE",
    "OTHER",
  ]),
  businessUnderstandingScore: z.number().min(0).max(100),
  clarityScore: z.number().min(0).max(100),
  trustScore: z.number().min(0).max(100),
  seoMessageFitScore: z.number().min(0).max(100),
  compliments: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
  priorityFixes: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
  quickWins0to3Days: z.array(z.string().min(1)).max(3),
  summary: z.string().min(1),
  confidence: z.number().min(0).max(1),
  lowConfidence: z.boolean().optional(),
});

export const lighthouseInterpretationSkillOutputSchema = z.object({
  scoreBandId: z.string().min(1),
  severity: z.enum(["EXTREME", "HIGH", "MEDIUM", "LOW"]),
  summary: z.string().min(1),
  conversionRisk: z.string().min(1),
  topPerformanceNarratives: z.array(z.string().min(1)),
  quickFixIdeas: z.array(z.string().min(1)),
});

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

export const pageContentSnapshotSchema = z.object({
  url: z.string().min(1),
  pageKind: z.enum(["HOMEPAGE", "INTERNAL"]),
  statusCode: z.number().int(),
  ok: z.boolean(),
  contentType: z.string().nullable(),
  title: z.string().nullable(),
  metaDescription: z.string().nullable(),
  h1: z.string().nullable(),
  headings: z.array(z.string()),
  heroText: z.string().nullable(),
  ctaTexts: z.array(z.string()),
  proofBlocks: z.array(z.string()),
  pricingBlocks: z.array(z.string()),
  testimonials: z.array(z.string()),
  navLabels: z.array(z.string()),
  footerTrustItems: z.array(z.string()),
  externalLinks: z.array(externalLinkSummarySchema),
  snippet: z.string().nullable(),
  text: z.string(),
});

export const scanJobSchema = z.object({
  id: z.string().uuid(),
  persistedRunId: z.string().uuid().nullable().optional(),
  persistedState: z.enum(["pending", "persisted", "unavailable"]).nullable().optional(),
  url: z.string().optional(),
  normalizedUrl: z.string().optional(),
  rootUrl: z.string().nullable().optional(),
  clientSessionId: z.string().optional(),
  analysisId: z.string().nullable().optional(),
  snapshotHash: z.string().nullable().optional(),
  cacheState: z.enum(["fresh", "attached", "resumed", "cached"]).nullable().optional(),
  currentStep: z.string().nullable().optional(),
  finalResponseState: z
    .enum(["RUNNING", "PARTIAL", "COMPLETED", "FAILED", "PAUSED"])
    .nullable()
    .optional(),
  status: z.string().min(1),
  errorMessage: z.string().nullable().optional(),
  previewRoast: z.string().nullable().optional(),
  fullRoast: z.string().nullable().optional(),
  qualityScore: z.number().nullable().optional(),
  qualityBand: z.enum(["EXCELLENT", "STRONG", "PASSABLE", "WEAK", "BROKEN"]).nullable().optional(),
  providerStatus: providerStatusSchema,
  lighthouseProfiles: z.object({
    mobile: lighthouseProfileSchema.nullable(),
    desktop: lighthouseProfileSchema.nullable(),
  }),
  siteUnderstanding: siteUnderstandingSkillOutputSchema.nullable().optional(),
  lighthouseInterpretation: lighthouseInterpretationSkillOutputSchema.nullable().optional(),
  finalPayload: finalRoastPayloadSchema.nullable().optional(),
  findings: z.array(scanFindingSchema),
  events: z.array(scanEventSchema),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const scanArtifactsResponseSchema = z.object({
  run: scanJobSchema,
  routeMapJson: routeMapSummarySchema.nullable(),
  pagesJson: z.array(pageContentSnapshotSchema).nullable(),
  externalLinksJson: z.array(externalLinkSummarySchema).nullable(),
  lighthouseMobileJson: z.record(z.string(), z.unknown()).nullable(),
  lighthouseDesktopJson: z.record(z.string(), z.unknown()).nullable(),
  siteUnderstandingJson: siteUnderstandingSkillOutputSchema.nullable(),
  finalPayloadJson: finalRoastPayloadSchema.nullable(),
  eventLog: z.array(scanEventSchema),
});

export const startScanRequestSchema = z.object({
  url: z.string().min(1),
  clientSessionId: z.string().min(1).optional(),
  replaceActiveScanId: z.string().uuid().optional(),
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

export const cancelScanRequestSchema = z.object({
  clientSessionId: z.string().min(1).optional(),
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
