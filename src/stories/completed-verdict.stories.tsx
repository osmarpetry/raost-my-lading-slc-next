import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { NotebookPanel } from "@/components/scan/notebook-panel";
import type { ScanJob } from "@/lib/shared/scans";

const completedScan: ScanJob = {
  id: "66666666-6666-6666-6666-666666666666",
  url: "https://example.com",
  normalizedUrl: "https://example.com/",
  status: "COMPLETED",
  previewRoast: "Clear product, but the hero still asks the visitor to infer too much.",
  fullRoast:
    "Clear product, but the hero still asks the visitor to infer too much. Move the payoff higher and give proof a better seat.",
  persistedRunId: "66666666-6666-6666-6666-666666666666",
  persistedState: "persisted",
  rootUrl: "https://example.com/",
  qualityScore: 72,
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
      score: 67,
      band: "PASSABLE",
      snapshot: {
        performance: 63,
        accessibility: 74,
        bestPractices: 70,
        seo: 71,
        strategy: "mobile",
        source: "local",
      },
    },
    desktop: {
      score: 77,
      band: "STRONG",
      snapshot: {
        performance: 76,
        accessibility: 79,
        bestPractices: 75,
        seo: 78,
        strategy: "desktop",
        source: "local",
      },
    },
  },
  finalPayload: null,
  findings: [
    {
      code: "HERO",
      severity: "HIGH",
      title: "Hero promise is still too abstract",
      roastLine: "The promise is there, but it does not land fast enough.",
    },
    {
      code: "PROOF",
      severity: "MEDIUM",
      title: "Proof is lower than it should be",
      roastLine: "Trust arrives after friction instead of before it.",
    },
  ],
  events: [],
};

const meta = {
  title: "Landing/CompletedVerdict",
  component: NotebookPanel,
  tags: ["autodocs"],
  render: (args) => (
    <div className="max-w-[680px]">
      <NotebookPanel {...args} />
    </div>
  ),
} satisfies Meta<typeof NotebookPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    transportState: "ready",
    scanState: "completed",
    isBusy: false,
    urlInput: "https://example.com",
    currentScan: completedScan,
    onUrlChange: () => undefined,
    onSubmit: () => undefined,
    onReset: () => undefined,
  },
};
