import type { HTMLAttributes } from "react";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/shared/cn";

const panelVariants = cva(
  "relative overflow-hidden rounded-panel border p-6 shadow-panel",
  {
    variants: {
      tone: {
        paper: "border-border-subtle bg-surface-panel text-text-primary",
        terminal:
          "terminal-surface border-border-strong bg-surface-terminal text-text-inverse shadow-terminal",
        subtle: "border-border-subtle bg-white/60 text-text-primary",
      },
      padding: {
        comfy: "p-6 md:p-8",
        dense: "p-4 md:p-5",
      },
    },
    defaultVariants: {
      tone: "paper",
      padding: "comfy",
    },
  },
);

type PanelProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof panelVariants>;

export function Panel({ className, tone, padding, ...props }: PanelProps) {
  return (
    <div className={cn(panelVariants({ tone, padding }), className)} {...props} />
  );
}
