import type { ReactNode } from "react";

interface LayoutShellProps {
  hero: ReactNode;
  realtime: ReactNode;
  footer?: ReactNode;
}

export function LayoutShell({ hero, realtime, footer }: LayoutShellProps) {
  return (
    <div className="site-canvas px-4 py-5 md:px-7 md:py-7">
      <div className="mx-auto flex w-full max-w-[var(--layout-content)] flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-pill border border-white/20 bg-white/10 px-5 py-4 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-white/72">
              yan-template-next-2026
            </p>
            <h1 className="font-display text-3xl leading-none text-white md:text-4xl">
              Next.js foundation for realtime product flows
            </h1>
          </div>
          <p className="max-w-xl font-mono text-sm text-white/74">
            App Router, Socket.IO, Storybook, Vitest, API integration tests, and
            Playwright BDD in one reusable base.
          </p>
        </header>

        <main className="grid gap-5 lg:min-h-[var(--layout-hero)] lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <section>{hero}</section>
          <section>{realtime}</section>
        </main>

        {footer ? <footer>{footer}</footer> : null}
      </div>
    </div>
  );
}
