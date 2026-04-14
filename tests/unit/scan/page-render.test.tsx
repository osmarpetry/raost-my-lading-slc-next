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
  persistedRunId: "77777777-7777-7777-7777-777777777777",
  persistedState: "persisted",
  rootUrl: "https://example.com/",
  qualityScore: 71,
  qualityBand: "PASSABLE",
  providerStatus: {
    lighthouse: {
      provider: "lighthouse",
      source: "local",
      reason: "Local Lighthouse completed",
      latencyMs: 1200,
    },
    openai: {
      provider: "openai",
      source: "live",
      reason: "OpenAI final synthesis completed",
      model: "gpt-5.4-nano",
      latencyMs: 800,
    },
  },
  lighthouseProfiles: {
    mobile: {
      score: 66,
      band: "PASSABLE",
      snapshot: {
        performance: 61,
        accessibility: 73,
        bestPractices: 70,
        seo: 69,
        strategy: "mobile",
        source: "local",
      },
    },
    desktop: {
      score: 76,
      band: "STRONG",
      snapshot: {
        performance: 75,
        accessibility: 78,
        bestPractices: 74,
        seo: 77,
        strategy: "desktop",
        source: "local",
      },
    },
  },
  finalPayload: null,
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
  hadModelStream: false,
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

    expect(screen.getByText("Latest run")).toBeInTheDocument();
    expect(screen.getByText("71")).toBeInTheDocument();
    expect(screen.getByText("/100")).toBeInTheDocument();
    expect(screen.getByText(/Clarify the value prop/)).toBeInTheDocument();
    expect(screen.getByRole("log").textContent).toContain("Scan completed");
  });
});
