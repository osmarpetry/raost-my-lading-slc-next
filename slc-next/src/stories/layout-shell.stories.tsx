import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ScanWorkbenchView } from "@/components/scan/scan-workbench-view";
import type { ScanJob, TerminalState } from "@/lib/shared/scans";

const idleTerminalState: TerminalState = {
  activeStreamLineId: null,
  hadOllamaStream: false,
  lines: [
    {
      id: "boot-1",
      channel: "system",
      prefix: "[system]",
      text: "local scan runtime ready",
      tone: "success",
    },
    {
      id: "boot-2",
      channel: "prompt",
      text: "roast@landing:~$ _",
      tone: "info",
      prompt: true,
    },
  ],
};

const completedScan: ScanJob = {
  id: "55555555-5555-5555-5555-555555555555",
  url: "https://example.com",
  normalizedUrl: "https://example.com/",
  status: "COMPLETED",
  previewRoast: "The promise is visible, but the proof arrives too late.",
  fullRoast:
    "The promise is visible, but the proof arrives too late. Tighten the hero and bring the trust cues higher.",
  qualityScore: 68,
  qualityBand: "PASSABLE",
  lighthouse: {
    performance: 58,
    accessibility: 74,
    bestPractices: 66,
    seo: 73,
  },
  findings: [
    {
      code: "PROOF",
      severity: "HIGH",
      title: "Proof arrives too late",
      roastLine: "Visitors have to scroll before they trust you.",
    },
  ],
  events: [],
};

const meta = {
  title: "Landing/Shell",
  component: ScanWorkbenchView,
  tags: ["autodocs"],
  render: (args) => <ScanWorkbenchView {...args} />,
} satisfies Meta<typeof ScanWorkbenchView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    urlInput: "https://example.com",
    transportState: "ready",
    scanState: "completed",
    activeScanId: completedScan.id,
    currentScan: completedScan,
    terminalState: idleTerminalState,
    viewportRef: { current: null },
    onUrlChange: () => undefined,
    onSubmit: () => undefined,
    onReset: () => undefined,
  },
};
