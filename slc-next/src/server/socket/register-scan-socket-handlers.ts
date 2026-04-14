import type { Server } from "socket.io";

import {
  scanSubscriptionSchema,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from "@/lib/shared/scans";
import { getScanSnapshot } from "@/server/api/scan-service";
import { scanManager } from "@/server/runtime";

type ScanIoServer = Server<ClientToServerEvents, ServerToClientEvents>;

export function registerScanSocketHandlers(io: ScanIoServer) {
  const unsubscribeFromEvents = scanManager.onScanEvent((scan, event) => {
    io.to(scan.id).emit("scan:event", event);
  });

  const unsubscribeFromErrors = scanManager.onScanError((scan, message) => {
    io.to(scan.id).emit("scan:error", { scanId: scan.id, message });
  });

  io.on("connection", (socket) => {
    socket.on("scan:subscribe", (payload) => {
      const parsed = scanSubscriptionSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("scan:error", {
          message: "Invalid scan subscription payload.",
        });
        return;
      }

      const { scanId } = parsed.data;
      socket.join(scanId);

      void getScanSnapshot(scanId).then((snapshot) => {
        if (!snapshot) {
          socket.emit("scan:error", {
            scanId,
            message: "Scan not found.",
          });
          return;
        }

        socket.emit("scan:snapshot", snapshot);
      });
    });

    socket.on("scan:unsubscribe", (payload) => {
      const parsed = scanSubscriptionSchema.safeParse(payload);
      if (!parsed.success) {
        return;
      }

      socket.leave(parsed.data.scanId);
    });
  });

  return () => {
    unsubscribeFromEvents();
    unsubscribeFromErrors();
  };
}
