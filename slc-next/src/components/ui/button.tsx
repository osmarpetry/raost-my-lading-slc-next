"use client";

import type { ButtonHTMLAttributes } from "react";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/shared/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-button px-5 font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-highlight disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      tone: {
        primary:
          "bg-accent-brand text-text-inverse shadow-panel hover:bg-accent-brand-strong",
        secondary:
          "border border-border-subtle bg-surface-panel-strong text-text-primary hover:bg-white/90",
        ghost: "text-text-secondary hover:text-text-primary",
      },
      size: {
        sm: "h-10 text-sm",
        md: "h-12 text-sm",
        lg: "h-14 text-base",
      },
    },
    defaultVariants: {
      tone: "primary",
      size: "md",
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({
  className,
  size,
  tone,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ tone, size }), className)}
      {...props}
    />
  );
}
