"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

import type {
  ScanEvent,
  ScanJob,
  ScanSubscription,
  ScanTransportError,
  TransportState,
} from "@/lib/shared/scans";
import { createScanSocketClient } from "@/lib/realtime/socket-client";

export interface ScanSocketLike {
  connected: boolean;
  on(...args: unknown[]): ScanSocketLike;
  off(...args: unknown[]): ScanSocketLike;
  emit(...args: unknown[]): void;
  connect(): void;
  disconnect(): void;
}

interface UseScanSubscriptionOptions {
  scanId: string | null;
  onEvent?: (event: ScanEvent) => void;
  onSnapshot?: (snapshot: ScanJob) => void;
  onError?: (error: ScanTransportError) => void;
  socketFactory?: () => ScanSocketLike;
}

export function useScanSubscription({
  scanId,
  onEvent,
  onSnapshot,
  onError,
  socketFactory = createScanSocketClient as unknown as () => ScanSocketLike,
}: UseScanSubscriptionOptions) {
  const socketRef = useRef<ScanSocketLike | null>(null);
  const activeScanIdRef = useRef<string | null>(scanId);
  const subscribedScanIdRef = useRef<string | null>(null);
  const [transportState, setTransportState] = useState<TransportState>("closed");

  const handleEvent = useEffectEvent((event: ScanEvent) => {
    onEvent?.(event);
  });

  const handleSnapshot = useEffectEvent((snapshot: ScanJob) => {
    onSnapshot?.(snapshot);
  });

  const handleError = useEffectEvent((error: ScanTransportError) => {
    setTransportState("error");
    onError?.(error);
  });

  useEffect(() => {
    activeScanIdRef.current = scanId;
  }, [scanId]);

  useEffect(() => {
    const socket = socketFactory();
    socketRef.current = socket;

    const onConnect = () => {
      setTransportState("ready");

      if (
        activeScanIdRef.current &&
        subscribedScanIdRef.current !== activeScanIdRef.current
      ) {
        socket.emit("scan:subscribe", { scanId: activeScanIdRef.current } satisfies ScanSubscription);
        subscribedScanIdRef.current = activeScanIdRef.current;
      }
    };

    const onDisconnect = () => {
      subscribedScanIdRef.current = null;
      setTransportState("closed");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("scan:event", handleEvent as (...args: unknown[]) => void);
    socket.on("scan:snapshot", handleSnapshot as (...args: unknown[]) => void);
    socket.on("scan:error", handleError as (...args: unknown[]) => void);

    if (activeScanIdRef.current) {
      socket.connect();
    }

    return () => {
      if (subscribedScanIdRef.current) {
        socket.emit("scan:unsubscribe", {
          scanId: subscribedScanIdRef.current,
        } satisfies ScanSubscription);
        subscribedScanIdRef.current = null;
      }

      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("scan:event", handleEvent as (...args: unknown[]) => void);
      socket.off("scan:snapshot", handleSnapshot as (...args: unknown[]) => void);
      socket.off("scan:error", handleError as (...args: unknown[]) => void);
      socket.disconnect();
      socketRef.current = null;
      setTransportState("closed");
    };
  }, [socketFactory]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) {
      return;
    }

    if (!scanId) {
      if (subscribedScanIdRef.current) {
        socket.emit("scan:unsubscribe", {
          scanId: subscribedScanIdRef.current,
        } satisfies ScanSubscription);
        subscribedScanIdRef.current = null;
      }
      return;
    }

    if (!socket.connected) {
      socket.connect();
      return;
    }

    if (subscribedScanIdRef.current && subscribedScanIdRef.current !== scanId) {
      socket.emit("scan:unsubscribe", {
        scanId: subscribedScanIdRef.current,
      } satisfies ScanSubscription);
      subscribedScanIdRef.current = null;
    }

    if (subscribedScanIdRef.current !== scanId) {
      socket.emit("scan:subscribe", { scanId } satisfies ScanSubscription);
      subscribedScanIdRef.current = scanId;
    }

    return () => {
      if (subscribedScanIdRef.current === scanId) {
        socket.emit("scan:unsubscribe", { scanId } satisfies ScanSubscription);
        subscribedScanIdRef.current = null;
      }
    };
  }, [scanId]);

  return {
    transportState,
    reconnect() {
      const socket = socketRef.current;
      if (!socket || !activeScanIdRef.current) {
        return;
      }

      setTransportState("connecting");
      socket.disconnect();
      socket.connect();
    },
  };
}
