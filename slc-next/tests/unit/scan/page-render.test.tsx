import { render, screen } from "@testing-library/react";

import { ScanWorkbenchView } from "@/components/scan/scan-workbench-view";
import type { ScanJob, TerminalState } from "@/lib/shared/scans";

const completedScan: ScanJob = {
  id: "77777777-7777-7777-7777-777777777777",
  url: "https://example.com",
  normalizedUrl: "https://example.com/",
  status: "COMPLETED",
  previewRoast: "Lead with the payoff instead of making the visitor infer it.",
  fullRoast: "Lead with the payoff instead of making the visitor infer it.",
  qualityScore: 71,
  qualityBand: "PASSABLE",
  lighthouse: null,
  findings: [
    {
      code: "VALUE_PROP",
      severity: "HIGH",
      title: "Clarify the value prop",
      roastLine: "The user still has to decode the offer.",
    },
  ],
  events: [],
};

const terminalState: TerminalState = {
  activeStreamLineId: null,
  hadOllamaStream: false,
  lines: [
    {
      id: "line-1",
      channel: "scan",
      prefix: "[scan]",
      text: "Scan completed",
      tone: "success",
    },
  ],
};

describe("scan workbench view", () => {
  it("renders the completed verdict state", () => {
    render(
      <ScanWorkbenchView
        urlInput="https://example.com"
        transportState="ready"
        scanState="completed"
        activeScanId={completedScan.id}
        currentScan={completedScan}
        terminalState={terminalState}
        viewportRef={{ current: null }}
        onUrlChange={() => undefined}
        onSubmit={() => undefined}
        onReset={() => undefined}
      />,
    );

    expect(screen.getByText("Latest verdict")).toBeInTheDocument();
    expect(screen.getByText(/71\/100/)).toBeInTheDocument();
    expect(screen.getByText(/Clarify the value prop/)).toBeInTheDocument();
    expect(screen.getByRole("log").textContent).toContain("Scan completed");
  });
});
