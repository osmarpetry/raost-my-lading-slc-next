import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TerminalPanel } from "@/components/scan/terminal-panel";
import type { TerminalState } from "@/lib/shared/scans";

function createTerminalState(lines: TerminalState["lines"]): TerminalState {
  return {
    lines,
    activeStreamLineId: null,
    hadModelStream: lines.some((line) => line.channel === "model"),
  };
}

const meta = {
  title: "Landing/TerminalStates",
  component: TerminalPanel,
  tags: ["autodocs"],
} satisfies Meta<typeof TerminalPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  args: {
    activeScanId: null,
    currentScan: null,
    terminalState: createTerminalState([
      {
        id: "1",
        channel: "system",
        prefix: "[system]",
        text: "local scan runtime ready",
        tone: "success",
      },
    ]),
    viewportRef: { current: null },
  },
};

export const Streaming: Story = {
  args: {
    activeScanId: "scan-123",
    currentScan: null,
    terminalState: createTerminalState([
      {
        id: "1",
        channel: "scan",
        prefix: "[scan]",
        text: "LIGHTHOUSE(local) · Running mobile profile",
        tone: "info",
      },
      {
        id: "2",
        channel: "model",
        prefix: "[model]",
        text: "The offer is visible but still over-explained.",
        tone: "success",
        streaming: true,
      },
    ]),
    viewportRef: { current: null },
  },
};

export const Completed: Story = {
  args: {
    activeScanId: "scan-456",
    currentScan: null,
    terminalState: createTerminalState([
      {
        id: "1",
        channel: "scan",
        prefix: "[scan]",
        text: "Scan completed",
        tone: "success",
      },
      {
        id: "2",
        channel: "model",
        prefix: "[model]",
        text: "Move proof higher and tighten the hero.",
        tone: "success",
      },
    ]),
    viewportRef: { current: null },
  },
};

export const Failed: Story = {
  args: {
    activeScanId: "scan-789",
    currentScan: null,
    terminalState: createTerminalState([
      {
        id: "1",
        channel: "error",
        prefix: "[error]",
        text: "Scan failed",
        tone: "error",
      },
    ]),
    viewportRef: { current: null },
  },
};
