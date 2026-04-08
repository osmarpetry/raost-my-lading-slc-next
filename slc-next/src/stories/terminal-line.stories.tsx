import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TerminalLineView } from "@/components/scan/terminal-line";

const meta = {
  title: "Landing/TerminalLine",
  component: TerminalLineView,
  tags: ["autodocs"],
} satisfies Meta<typeof TerminalLineView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Scan: Story = {
  args: {
    line: {
      id: "line-1",
      channel: "scan",
      prefix: "[scan]",
      text: "QUALITY · Running Lighthouse",
      tone: "info",
    },
  },
};

export const Ollama: Story = {
  args: {
    line: {
      id: "line-2",
      channel: "ollama",
      prefix: "[ollama]",
      text: "The headline is clean, but the proof section still drags.",
      tone: "success",
      streaming: true,
    },
  },
};

export const Error: Story = {
  args: {
    line: {
      id: "line-3",
      channel: "error",
      prefix: "[error]",
      text: "Scan failed",
      tone: "error",
    },
  },
};
