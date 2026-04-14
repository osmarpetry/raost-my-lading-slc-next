import type {
  ParsedScanEventPayload,
  ScanEvent,
  ScanEventRender,
  ScanJob,
  TerminalChannel,
  TerminalLineSeed,
  TerminalTone,
} from "@/lib/shared/scans";

const CHANNEL_PREFIX: Record<Exclude<TerminalChannel, "prompt">, string> = {
  system: "[system]",
  ws: "[ws]",
  http: "[http]",
  scan: "[scan]",
  model: "[model]",
  error: "[error]",
};

export function createTerminalLine(
  channel: Exclude<TerminalChannel, "prompt">,
  text: string,
  options: { tone?: TerminalTone; streaming?: boolean } = {},
): TerminalLineSeed {
  return {
    channel,
    prefix: CHANNEL_PREFIX[channel],
    text,
    tone: options.tone ?? "info",
    streaming: options.streaming,
  };
}

export function parsePayload(payloadJson?: string | null): ParsedScanEventPayload | null {
  if (!payloadJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(payloadJson);
    return parsed && typeof parsed === "object" ? (parsed as ParsedScanEventPayload) : null;
  } catch {
    return null;
  }
}

export function validateTargetUrl(
  value: string,
): { ok: true; url: string } | { ok: false; message: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, message: "enter a URL before starting scan" };
  }

  try {
    const url = new URL(trimmed);
    if (!["http:", "https:"].includes(url.protocol)) {
      return { ok: false, message: "only http and https URLs supported" };
    }
    return { ok: true, url: trimmed };
  } catch {
    return { ok: false, message: "that is not valid absolute URL" };
  }
}

export function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "unexpected transport error";
}

export function describeScanEvent(event: ScanEvent): ScanEventRender {
  const payload = parsePayload(event.payloadJson);

  switch (event.eventType) {
    case "SCAN_STAGE":
      return {
        lines: [
          createTerminalLine("scan", event.message, {
            tone: event.stage === "FAILED" ? "error" : "info",
          }),
        ],
        flushStream: payload?.flushStream === true,
      };
    case "PAGE_SCANNED":
      return {
        lines: [
          createTerminalLine(
            "scan",
            `CRAWL · ${String(payload?.pageKind ?? "UNKNOWN")} ${String(payload?.url ?? "unknown url")}`,
            { tone: "muted" },
          ),
        ],
        flushStream: false,
      };
    case "EXTERNAL_LINK_CHECKED":
      return {
        lines: [
          createTerminalLine(
            "scan",
            `EXTERNAL · ${String(payload?.url ?? "unknown target")} loaded=${String(payload?.loaded ?? false)}`,
            { tone: "muted" },
          ),
        ],
        flushStream: false,
      };
    case "LLM_CHUNK":
      return {
        lines: [],
        modelChunk:
          typeof payload?.textDelta === "string"
            ? payload.textDelta
            : typeof payload?.chunk === "string"
              ? payload.chunk
              : "",
        flushStream: false,
      };
    case "FINDINGS_READY":
      return {
        lines: [
          createTerminalLine("scan", `ARTIFACTS · persisted ${String(payload?.count ?? 0)} findings`, {
            tone: "success",
          }),
        ],
        flushStream: true,
      };
    case "JOB_COMPLETED":
      return {
        lines: [createTerminalLine("scan", event.message, { tone: "success" })],
        flushStream: true,
      };
    case "JOB_FAILED":
    case "JOB_CANCELLED":
      return {
        lines: [createTerminalLine("error", String(payload?.error ?? event.message), { tone: "error" })],
        flushStream: true,
        nextScanState: "failed",
      };
  }
}

export function renderCompletedScan(
  scan: ScanJob,
  options: { includeFullRoast?: boolean } = {},
): TerminalLineSeed[] {
  const lines: TerminalLineSeed[] = [];

  if (scan.previewRoast) {
    lines.push(createTerminalLine("scan", `SUMMARY · ${scan.previewRoast}`, { tone: "success" }));
  }

  if ((options.includeFullRoast ?? true) && scan.fullRoast) {
    lines.push(createTerminalLine("model", scan.fullRoast, { tone: "success" }));
  }

  if (scan.qualityScore != null) {
    lines.push(
      createTerminalLine(
        "scan",
        `SCORE · Mobile ${scan.lighthouseProfiles.mobile?.score ?? "n/a"}, Desktop ${scan.lighthouseProfiles.desktop?.score ?? "n/a"}, Combined ${scan.qualityScore}`,
        { tone: "success" },
      ),
    );
  }

  for (const finding of scan.findings.slice(0, 3)) {
    lines.push(
      createTerminalLine(
        "scan",
        `FINDING · [${finding.severity}] ${finding.title}${finding.roastLine ? ` · ${finding.roastLine}` : ""}`,
        { tone: finding.severity === "LOW" ? "muted" : "info" },
      ),
    );
  }

  return lines;
}
