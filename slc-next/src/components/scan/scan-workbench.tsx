"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ScanWorkbenchView } from "@/components/scan/scan-workbench-view";
import { createBootSequence, createPromptLine, createReadyLines } from "@/lib/terminal/boot";
import {
  createTerminalLine,
  describeScanEvent,
  formatUnknownError,
  renderCompletedScan,
  validateTargetUrl,
} from "@/lib/terminal/format";
import {
  addTerminalLines,
  appendOllamaChunk,
  dismissPrompt,
  flushOllamaStream,
} from "@/lib/terminal/stream";
import { useScanSubscription } from "@/lib/realtime/use-scan-subscription";
import type {
  ScanEvent,
  ScanEventRender,
  ScanJob,
  ScanState,
  StartScanResult,
  TerminalLineSeed,
  TerminalState,
  TransportState,
} from "@/lib/shared/scans";
import { scanJobSchema, startScanResultSchema } from "@/lib/shared/scans";

const API_BASE_PATH = "/api/scans";

async function startScanRequest(url: string) {
  const response = await fetch(API_BASE_PATH, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error((payload as { message?: string }).message ?? "Request failed");
  }

  return startScanResultSchema.parse(payload);
}

async function fetchScanSnapshot(scanId: string) {
  const response = await fetch(`${API_BASE_PATH}/${scanId}`, {
    cache: "no-store",
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error((payload as { message?: string }).message ?? "Request failed");
  }

  return scanJobSchema.parse(payload);
}

export function ScanWorkbench() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryScanId = searchParams.get("scanId");

  const terminalViewport = useRef<HTMLDivElement | null>(null);
  const activePoller = useRef<{ cancel(): void } | null>(null);
  const lastSeenEventSeq = useRef(0);
  const terminalStateRef = useRef<TerminalState | null>(null);
  const activeScanIdRef = useRef<string | null>(null);
  const scanStateRef = useRef<ScanState>("idle");

  const [urlInput, setUrlInput] = useState("");
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [currentScan, setCurrentScan] = useState<ScanJob | null>(null);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [terminalState, setTerminalState] = useState<TerminalState>(() =>
    addTerminalLines(
      addTerminalLines(
        {
          lines: [],
          activeStreamLineId: null,
          hadOllamaStream: false,
        },
        createBootSequence(API_BASE_PATH),
      ),
      [...createReadyLines(), createPromptLine()],
    ),
  );

  useEffect(() => {
    terminalStateRef.current = terminalState;
  }, [terminalState]);

  useEffect(() => {
    activeScanIdRef.current = activeScanId;
  }, [activeScanId]);

  useEffect(() => {
    scanStateRef.current = scanState;
  }, [scanState]);

  const { transportState: liveTransportState, reconnect } = useScanSubscription({
    scanId: activeScanId,
    onSnapshot: (scan) => {
      applySnapshotScan(scan);
    },
    onEvent: (event) => {
      lastSeenEventSeq.current = Math.max(lastSeenEventSeq.current, event.seq);
      applyTerminalUpdate(describeScanEvent(event));
    },
    onError: (error) => {
      pushLines(createTerminalLine("error", error.message, { tone: "error" }));
      if (scanStateRef.current === "streaming") {
        reconnect();
      }
    },
  });

  const transportState: TransportState = activeScanId ? liveTransportState : "ready";

  function queueScroll() {
    requestAnimationFrame(() => {
      const viewport = terminalViewport.current;
      if (!viewport) {
        return;
      }

      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: "smooth",
      });
    });
  }

  function pushLines(...entries: TerminalLineSeed[]) {
    setTerminalState((current) => addTerminalLines(current, entries));
    queueScroll();
  }

  function applyTerminalUpdate(update: ScanEventRender) {
    setTerminalState((current) => {
      let nextState = current;

      if (update.ollamaChunk) {
        nextState = appendOllamaChunk(nextState, update.ollamaChunk);
      }

      if (update.flushStream) {
        nextState = flushOllamaStream(nextState);
      }

      if (update.lines.length > 0) {
        nextState = addTerminalLines(nextState, update.lines);
      }

      return nextState;
    });

    queueScroll();
  }

  function unseenScanEvents(scan: ScanJob): ScanEvent[] {
    return [...scan.events]
      .sort((left, right) => left.seq - right.seq)
      .filter((event) => event.seq > lastSeenEventSeq.current);
  }

  function showPrompt() {
    setTerminalState((current) => addTerminalLines(dismissPrompt(current), [createPromptLine()]));
    queueScroll();
  }

  function hidePrompt() {
    setTerminalState((current) => dismissPrompt(current));
    queueScroll();
  }

  function finishScan(nextState: Extract<ScanState, "completed" | "failed">, scan?: ScanJob | null) {
    activePoller.current?.cancel();
    activePoller.current = null;
    setActiveScanId(null);
    setScanState(nextState);
    if (scan) {
      setCurrentScan(scan);
    }
    setTerminalState((current) => ({
      ...current,
      activeStreamLineId: null,
      hadOllamaStream: false,
    }));
    showPrompt();
  }

  function applySnapshotScan(scan: ScanJob) {
    setCurrentScan(scan);

    const unseenEvents = unseenScanEvents(scan);
    for (const event of unseenEvents) {
      lastSeenEventSeq.current = Math.max(lastSeenEventSeq.current, event.seq);
      applyTerminalUpdate(describeScanEvent(event));
    }

    if (scan.status === "COMPLETED") {
      applyTerminalUpdate({
        lines: renderCompletedScan(scan, {
          includeFullRoast: !terminalStateRef.current?.hadOllamaStream,
        }),
        flushStream: true,
      });
      finishScan("completed", scan);
      return;
    }

    if (scan.status === "FAILED" || scan.status === "CANCELLED") {
      const hasFailureEvent = unseenEvents.some(
        (event) => event.eventType === "JOB_FAILED" || event.eventType === "JOB_CANCELLED",
      );

      if (!hasFailureEvent) {
        applyTerminalUpdate({
          lines: [
            createTerminalLine(
              "error",
              scan.errorMessage || `scan ended with status ${scan.status.toLowerCase()}`,
              { tone: "error" },
            ),
          ],
          flushStream: true,
        });
      }

      finishScan("failed", scan);
    }
  }

  function startPollingScan(scanId: string) {
    activePoller.current?.cancel();
    let cancelled = false;

    const run = async () => {
      while (!cancelled && activeScanIdRef.current === scanId) {
        try {
          const scan = await fetchScanSnapshot(scanId);
          applySnapshotScan(scan);

          if (scanStateRef.current !== "streaming" || activeScanIdRef.current !== scanId) {
            return;
          }
        } catch (error) {
          pushLines(createTerminalLine("error", formatUnknownError(error), { tone: "error" }));
        }

        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
    };

    void run();

    activePoller.current = {
      cancel() {
        cancelled = true;
      },
    };
  }

  async function submitScan() {
    const validation = validateTargetUrl(urlInput);
    if (!validation.ok) {
      pushLines(createTerminalLine("error", validation.message, { tone: "error" }));
      return;
    }

    hidePrompt();
    setScanState("submitting");
    lastSeenEventSeq.current = 0;
    pushLines(
      createTerminalLine("http", `dispatching startScan for ${validation.url}`),
      createTerminalLine("system", "binding websocket and poller to this session", {
        tone: "muted",
      }),
    );

    try {
      const started: StartScanResult = await startScanRequest(validation.url);
      setActiveScanId(started.scanId);
      setScanState("streaming");
      pushLines(
        createTerminalLine("http", `startScan accepted scanId=${started.scanId}`, {
          tone: "success",
        }),
        createTerminalLine("http", `polling local scan ${started.scanId} for progress`, {
          tone: "muted",
        }),
      );
      router.replace(`/?scanId=${started.scanId}`, { scroll: false });
      startPollingScan(started.scanId);
    } catch (error) {
      pushLines(createTerminalLine("error", formatUnknownError(error), { tone: "error" }));
      setScanState("failed");
      showPrompt();
    }
  }

  function resetScan() {
    activePoller.current?.cancel();
    activePoller.current = null;
    lastSeenEventSeq.current = 0;
    setActiveScanId(null);
    setCurrentScan(null);
    setScanState("idle");
    setTerminalState((current) => addTerminalLines(dismissPrompt(current), [createPromptLine()]));
    router.replace("/", { scroll: false });
  }

  const restoreScan = useEffectEvent(async (scanId: string) => {
    try {
      const scan = await fetchScanSnapshot(scanId);
      setCurrentScan(scan);
      if (scan.url) {
        setUrlInput(scan.url);
      }

      if (scan.status === "QUEUED" || scan.status === "RUNNING") {
        setActiveScanId(scan.id);
        setScanState("streaming");
        startPollingScan(scan.id);
      }

      applySnapshotScan(scan);
    } catch (error) {
      setTerminalState((current) =>
        addTerminalLines(current, [
          createTerminalLine("error", formatUnknownError(error), { tone: "error" }),
        ]),
      );
    }
  });

  useEffect(() => {
    if (!queryScanId) {
      return;
    }

    if (currentScan?.id === queryScanId) {
      return;
    }

    void restoreScan(queryScanId);
  }, [currentScan?.id, queryScanId]);

  return (
    <ScanWorkbenchView
      urlInput={urlInput}
      transportState={transportState}
      scanState={scanState}
      activeScanId={activeScanId ?? currentScan?.id ?? null}
      currentScan={currentScan}
      terminalState={terminalState}
      viewportRef={terminalViewport}
      onUrlChange={setUrlInput}
      onSubmit={() => void submitScan()}
      onReset={resetScan}
    />
  );
}
