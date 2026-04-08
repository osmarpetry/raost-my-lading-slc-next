import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TokenDocs } from "@/components/realtime/token-docs";

const meta = {
  title: "Design/Tokens",
  component: TokenDocs,
  tags: ["autodocs"],
  render: () => (
    <div className="site-shell">
      <div className="site-background">
        <div className="layout-frame">
          <div className="mb-6">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-text-secondary">
            Semantic token registry
          </p>
          <h2 className="mt-3 font-display text-5xl text-text-primary">
            TypeScript tokens drive the visual contract.
          </h2>
          <p className="mt-3 max-w-2xl text-text-secondary">
            SLC lifts the original landing page palette and notebook/terminal
            values into semantic tokens so the React port keeps the same visual
            identity.
          </p>
        </div>
        <TokenDocs />
        </div>
      </div>
    </div>
  ),
} satisfies Meta<typeof TokenDocs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Gallery: Story = {};
