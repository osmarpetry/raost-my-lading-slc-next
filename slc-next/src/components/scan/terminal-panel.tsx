import type { RefObject } from "react";

import { TerminalLineView } from "@/components/scan/terminal-line";
import type { TerminalState } from "@/lib/shared/scans";

interface TerminalPanelProps {
  activeScanId: string | null;
  terminalState: TerminalState;
  viewportRef: RefObject<HTMLDivElement | null>;
}

export function TerminalPanel({
  activeScanId,
  terminalState,
  viewportRef,
}: TerminalPanelProps) {
  return (
    <section
      className="layout-panel layout-panel--main terminal-card"
      aria-label="Live terminal panel"
    >
      <div className="terminal-topbar">
        <div className="terminal-lights" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="terminal-meta">
          <span
            className="terminal-meta-line"
            data-terminal-meta={`ssh live@scan-broker // ${activeScanId ?? "session: standby"}`}
          >
            ssh live@scan-broker // {activeScanId ?? "session: standby"}
          </span>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="terminal-log"
        role="log"
        aria-live="polite"
      >
        {terminalState.lines.map((line) => (
          <TerminalLineView key={line.id} line={line} />
        ))}
      </div>
    </section>
  );
}
