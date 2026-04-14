import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { UrlForm } from "@/components/scan/url-form";

const meta = {
  title: "Landing/UrlForm",
  component: UrlForm,
  tags: ["autodocs"],
  args: {
    value: "https://example.com",
    disabled: false,
    onChange: () => undefined,
    onSubmit: () => undefined,
  },
  render: (args) => (
    <div className="max-w-xl p-8">
      <UrlForm {...args} />
    </div>
  ),
} satisfies Meta<typeof UrlForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
