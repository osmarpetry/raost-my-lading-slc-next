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
  appendModelChunk,
  dismissPrompt,
  flushModelStream,
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
const MOBILE_LAYOUT_MEDIA_QUERY = "(max-width: 980px)";
const CLIENT_SESSION_STORAGE_KEY = "roast-my-landing:client-session-id";

function createInitialTerminalState(): TerminalState {
  return addTerminalLines(
    addTerminalLines(
      {
        lines: [],
        activeStreamLineId: null,
        hadModelStream: false,
      },
      createBootSequence(API_BASE_PATH),
    ),
    [...createReadyLines(), createPromptLine()],
  );
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

async function startScanRequest(
  url: string,
  options: {
    clientSessionId: string;
    replaceActiveScanId?: string | null;
    signal?: AbortSignal;
  },
) {
  const response = await fetch(API_BASE_PATH, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      url,
      clientSessionId: options.clientSessionId,
      replaceActiveScanId: options.replaceActiveScanId ?? undefined,
    }),
    signal: options.signal,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error((payload as { message?: string }).message ?? "Request failed");
  }

  return startScanResultSchema.parse(payload);
}

async function fetchScanSnapshot(scanId: string, signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_PATH}/${scanId}`, {
    cache: "no-store",
    signal,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error((payload as { message?: string }).message ?? "Request failed");
  }

  return scanJobSchema.parse(payload);
}

async function cancelScanRequest(scanId: string, clientSessionId: string) {
  const response = await fetch(`${API_BASE_PATH}/${scanId}/cancel`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ clientSessionId }),
  });

  if (!response.ok) {
    return null;
  }

  return scanJobSchema.parse(await response.json());
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
  const sessionVersionRef = useRef(0);
  const ignoredQueryScanIdRef = useRef<string | null>(null);
  const startRequestAbortRef = useRef<AbortController | null>(null);
  const snapshotRequestAbortRef = useRef<AbortController | null>(null);
  const clientSessionIdRef = useRef<string>("");

  const [urlInput, setUrlInput] = useState("");
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [currentScan, setCurrentScan] = useState<ScanJob | null>(null);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [terminalState, setTerminalState] = useState<TerminalState>(() => createInitialTerminalState());

  useEffect(() => {
    terminalStateRef.current = terminalState;
  }, [terminalState]);

  useEffect(() => {
    activeScanIdRef.current = activeScanId;
  }, [activeScanId]);

  useEffect(() => {
    scanStateRef.current = scanState;
  }, [scanState]);

  function getClientSessionId() {
    if (clientSessionIdRef.current) {
      return clientSessionIdRef.current;
    }

    const generated = globalThis.crypto?.randomUUID?.() ?? `session-${Date.now().toString(36)}`;
    if (typeof window !== "undefined") {
      const existing = window.localStorage.getItem(CLIENT_SESSION_STORAGE_KEY);
      if (existing) {
        clientSessionIdRef.current = existing;
        return existing;
      }

      window.localStorage.setItem(CLIENT_SESSION_STORAGE_KEY, generated);
    }

    clientSessionIdRef.current = generated;
    return generated;
  }

  useEffect(() => {
    void getClientSessionId();
  }, []);

  const { transportState: liveTransportState, reconnect } = useScanSubscription({
    scanId: activeScanId,
    onSnapshot: (scan) => {
      if (!activeScanIdRef.current || scan.id !== activeScanIdRef.current) {
        return;
      }

      applySnapshotScan(scan);
    },
    onEvent: (event) => {
      if (!activeScanIdRef.current || event.scanId !== activeScanIdRef.current) {
        return;
      }

      lastSeenEventSeq.current = Math.max(lastSeenEventSeq.current, event.seq);
      applyTerminalUpdate(describeScanEvent(event));
    },
    onError: (error) => {
      if (error.scanId && activeScanIdRef.current && error.scanId !== activeScanIdRef.current) {
        return;
      }

      pushLines(createTerminalLine("error", error.message, { tone: "error" }));
      if (scanStateRef.current === "streaming") {
        reconnect();
      }
    },
  });

  const transportState: TransportState = activeScanId ? liveTransportState : "ready";

  function focusTerminalOnMobile() {
    if (typeof window === "undefined") {
      return;
    }

    if (!window.matchMedia(MOBILE_LAYOUT_MEDIA_QUERY).matches) {
      return;
    }

    requestAnimationFrame(() => {
      const viewport = terminalViewport.current;
      if (!viewport) {
        return;
      }

      viewport.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      viewport.focus();
    });
  }

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

      if (update.modelChunk) {
        nextState = appendModelChunk(nextState, update.modelChunk);
      }

      if (update.flushStream) {
        nextState = flushModelStream(nextState);
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

  function abortInflightRequests() {
    startRequestAbortRef.current?.abort();
    startRequestAbortRef.current = null;
    snapshotRequestAbortRef.current?.abort();
    snapshotRequestAbortRef.current = null;
  }

  function finishScan(nextState: Extract<ScanState, "completed" | "failed">, scan?: ScanJob | null) {
    activePoller.current?.cancel();
    activePoller.current = null;
    abortInflightRequests();
    activeScanIdRef.current = null;
    scanStateRef.current = nextState;
    setActiveScanId(null);
    setScanState(nextState);
    if (scan) {
      setCurrentScan(scan);
    }
    setTerminalState((current) => ({
      ...current,
      activeStreamLineId: null,
      hadModelStream: false,
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
          includeFullRoast: !terminalStateRef.current?.hadModelStream,
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

  function startPollingScan(scanId: string, sessionVersion = sessionVersionRef.current) {
    activePoller.current?.cancel();
    let cancelled = false;

    const run = async () => {
      while (!cancelled && activeScanIdRef.current === scanId) {
        const controller = new AbortController();
        snapshotRequestAbortRef.current?.abort();
        snapshotRequestAbortRef.current = controller;

        try {
          const scan = await fetchScanSnapshot(scanId, controller.signal);

          if (
            cancelled ||
            controller.signal.aborted ||
            sessionVersion !== sessionVersionRef.current ||
            activeScanIdRef.current !== scanId
          ) {
            return;
          }

          applySnapshotScan(scan);

          if (scanStateRef.current !== "streaming" || activeScanIdRef.current !== scanId) {
            return;
          }
        } catch (error) {
          if (
            cancelled ||
            controller.signal.aborted ||
            sessionVersion !== sessionVersionRef.current ||
            isAbortError(error)
          ) {
            return;
          }

          pushLines(createTerminalLine("error", formatUnknownError(error), { tone: "error" }));
        } finally {
          if (snapshotRequestAbortRef.current === controller) {
            snapshotRequestAbortRef.current = null;
          }
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
    focusTerminalOnMobile();

    const validation = validateTargetUrl(urlInput);
    if (!validation.ok) {
      pushLines(createTerminalLine("error", validation.message, { tone: "error" }));
      return;
    }

    sessionVersionRef.current += 1;
    const sessionVersion = sessionVersionRef.current;
    const replaceActiveScanId = activeScanIdRef.current ?? currentScan?.id ?? null;
    activePoller.current?.cancel();
    activePoller.current = null;
    abortInflightRequests();
    ignoredQueryScanIdRef.current = null;
    hidePrompt();
    setCurrentScan(null);
    activeScanIdRef.current = null;
    scanStateRef.current = "submitting";
    setScanState("submitting");
    setActiveScanId(null);
    lastSeenEventSeq.current = 0;

    const controller = new AbortController();
    startRequestAbortRef.current = controller;

    pushLines(
      createTerminalLine("http", `dispatching startScan for ${validation.url}`),
      createTerminalLine("system", "binding websocket and poller to this session", {
        tone: "muted",
      }),
    );

    try {
      const started: StartScanResult = await startScanRequest(validation.url, {
        clientSessionId: getClientSessionId(),
        replaceActiveScanId,
        signal: controller.signal,
      });

      if (
        controller.signal.aborted ||
        sessionVersion !== sessionVersionRef.current
      ) {
        return;
      }

      if (startRequestAbortRef.current === controller) {
        startRequestAbortRef.current = null;
      }

      activeScanIdRef.current = started.scanId;
      scanStateRef.current = "streaming";
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
      startPollingScan(started.scanId, sessionVersion);
    } catch (error) {
      if (
        controller.signal.aborted ||
        sessionVersion !== sessionVersionRef.current ||
        isAbortError(error)
      ) {
        return;
      }

      if (startRequestAbortRef.current === controller) {
        startRequestAbortRef.current = null;
      }

      pushLines(createTerminalLine("error", formatUnknownError(error), { tone: "error" }));
      activeScanIdRef.current = null;
      scanStateRef.current = "failed";
      setScanState("failed");
      showPrompt();
    }
  }

  function resetScan() {
    const targetScanId = activeScanIdRef.current ?? currentScan?.id ?? null;
    if (targetScanId) {
      void cancelScanRequest(targetScanId, getClientSessionId());
    }

    sessionVersionRef.current += 1;
    ignoredQueryScanIdRef.current = queryScanId ?? activeScanIdRef.current ?? currentScan?.id ?? null;
    activePoller.current?.cancel();
    activePoller.current = null;
    abortInflightRequests();
    lastSeenEventSeq.current = 0;
    activeScanIdRef.current = null;
    scanStateRef.current = "idle";
    setActiveScanId(null);
    setCurrentScan(null);
    setScanState("idle");
    setTerminalState(createInitialTerminalState());
    router.replace("/", { scroll: false });
  }

  const restoreScan = useEffectEvent(async (scanId: string) => {
    sessionVersionRef.current += 1;
    const sessionVersion = sessionVersionRef.current;
    activePoller.current?.cancel();
    activePoller.current = null;
    abortInflightRequests();

    const controller = new AbortController();
    snapshotRequestAbortRef.current = controller;

    try {
      const scan = await fetchScanSnapshot(scanId, controller.signal);

      if (
        controller.signal.aborted ||
        sessionVersion !== sessionVersionRef.current
      ) {
        return;
      }

      if (snapshotRequestAbortRef.current === controller) {
        snapshotRequestAbortRef.current = null;
      }

      setCurrentScan(scan);
      if (scan.url) {
        setUrlInput(scan.url);
      }

      if (scan.status === "QUEUED" || scan.status === "RUNNING") {
        activeScanIdRef.current = scan.id;
        scanStateRef.current = "streaming";
        setActiveScanId(scan.id);
        setScanState("streaming");
        startPollingScan(scan.id, sessionVersion);
      }

      applySnapshotScan(scan);
    } catch (error) {
      if (
        controller.signal.aborted ||
        sessionVersion !== sessionVersionRef.current ||
        isAbortError(error)
      ) {
        return;
      }

      setTerminalState((current) =>
        addTerminalLines(current, [
          createTerminalLine("error", formatUnknownError(error), { tone: "error" }),
        ]),
      );
    } finally {
      if (snapshotRequestAbortRef.current === controller) {
        snapshotRequestAbortRef.current = null;
      }
    }
  });

  useEffect(() => {
    return () => {
      activePoller.current?.cancel();
      abortInflightRequests();
    };
  }, []);

  useEffect(() => {
    if (!queryScanId) {
      ignoredQueryScanIdRef.current = null;
      return;
    }

    if (ignoredQueryScanIdRef.current === queryScanId) {
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
