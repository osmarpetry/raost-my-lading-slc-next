import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Panel } from "@/components/ui/panel";

const meta = {
  title: "Primitives/Panel",
  component: Panel,
  tags: ["autodocs"],
  render: (args) => (
    <div className="p-6">
      <Panel {...args}>
        <h3 className="font-display text-2xl">Panel surface</h3>
        <p className="mt-3 text-text-secondary">
          Reusable container primitive for notebook, neutral, and terminal
          surfaces.
        </p>
      </Panel>
    </div>
  ),
} satisfies Meta<typeof Panel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Paper: Story = {
  args: {
    tone: "paper",
  },
};

export const Terminal: Story = {
  args: {
    tone: "terminal",
  },
};
