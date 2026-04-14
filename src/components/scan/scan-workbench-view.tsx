import type { RefObject } from "react";

import { NotebookPanel } from "@/components/scan/notebook-panel";
import { TerminalPanel } from "@/components/scan/terminal-panel";
import type { ScanJob, ScanState, TerminalState, TransportState } from "@/lib/shared/scans";

interface ScanWorkbenchViewProps {
  urlInput: string;
  transportState: TransportState;
  scanState: ScanState;
  activeScanId: string | null;
  currentScan: ScanJob | null;
  terminalState: TerminalState;
  viewportRef: RefObject<HTMLDivElement | null>;
  onUrlChange: (value: string) => void;
  onSubmit: () => void;
  onReset: () => void;
}

export function ScanWorkbenchView({
  urlInput,
  transportState,
  scanState,
  activeScanId,
  currentScan,
  terminalState,
  viewportRef,
  onUrlChange,
  onSubmit,
  onReset,
}: ScanWorkbenchViewProps) {
  return (
    <div className="site-shell">
      <div className="site-background">
        <div className="layout-frame">
          <main className="layout-grid layout-grid--split">
            <NotebookPanel
              transportState={transportState}
              scanState={scanState}
              isBusy={scanState === "submitting" || scanState === "streaming"}
              urlInput={urlInput}
              currentScan={currentScan}
              onUrlChange={onUrlChange}
              onSubmit={onSubmit}
              onReset={onReset}
            />
            <TerminalPanel
              activeScanId={activeScanId}
              currentScan={currentScan}
              terminalState={terminalState}
              viewportRef={viewportRef}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
