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
  qualityScore: 72,
  qualityBand: "PASSABLE",
  lighthouse: null,
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
