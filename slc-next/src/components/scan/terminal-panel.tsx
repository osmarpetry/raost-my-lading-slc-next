import type { RefObject } from "react";

import { TerminalLineView } from "@/components/scan/terminal-line";
import type { ScanJob, TerminalState } from "@/lib/shared/scans";

interface TerminalPanelProps {
  activeScanId: string | null;
  currentScan: ScanJob | null;
  terminalState: TerminalState;
  viewportRef: RefObject<HTMLDivElement | null>;
}

export function TerminalPanel({
  activeScanId,
  currentScan,
  terminalState,
  viewportRef,
}: TerminalPanelProps) {
  return (
    <section className="layout-panel layout-panel--main terminal-card" aria-label="Live terminal panel">
      <div className="terminal-topbar">
        <div className="terminal-title">
          <span className="terminal-meta-label">terminal</span>
          <strong>{currentScan?.normalizedUrl ?? "session: standby"}</strong>
        </div>
        <div className="terminal-meta">
          <span className="terminal-meta-line">run {activeScanId ?? currentScan?.id ?? "standby"}</span>
          <span className="terminal-meta-line">
            {currentScan?.providerStatus.lighthouse.source ?? "local"} / {currentScan?.providerStatus.openai.source ?? "pending"}
          </span>
        </div>
      </div>

      <div ref={viewportRef} className="terminal-log" role="log" aria-live="polite" tabIndex={-1}>
        {terminalState.lines.map((line) => (
          <TerminalLineView key={line.id} line={line} />
        ))}
      </div>
    </section>
  );
}
