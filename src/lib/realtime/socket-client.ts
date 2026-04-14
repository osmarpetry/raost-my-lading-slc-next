"use client";

import { io, type Socket } from "socket.io-client";

import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/lib/shared/scans";

export type ScanSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createScanSocketClient() {
  return io({
    autoConnect: false,
    path: "/socket.io",
    transports: ["websocket"],
  });
}
