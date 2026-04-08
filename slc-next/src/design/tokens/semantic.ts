import type { TokenTree } from "./types";

export const semanticTokens = {
  color: {
    surface: {
      app: "{color.background.base}",
      panel: "{color.surface.paper}",
      panelElevated: "{color.background.elevated}",
      terminal: "{color.surface.terminal}",
      terminalTopbar: "{color.surface.terminalTopbar}",
    },
    text: {
      primary: "{color.text.primary}",
      secondary: "{color.text.secondary}",
      inverse: "{color.text.inverse}",
    },
    border: {
      subtle: "{color.border.soft}",
      strong: "{color.border.strong}",
    },
    accent: {
      brand: "{color.accent.olive}",
      brandStrong: "{color.accent.oliveDeep}",
      danger: "{color.accent.red}",
      warning: "{color.accent.warning}",
      success: "{color.accent.success}",
      info: "{color.accent.info}",
    },
    status: {
      idle: "{color.effect.statusIdle}",
      live: "{color.effect.statusLive}",
      error: "{color.effect.statusError}",
    },
  },
  effect: {
    shadow: {
      panel: "{shadow.panel}",
      paper: "{shadow.paper}",
      floating: "{shadow.float}",
    },
    texture: {
      gridLine: "{color.effect.gridLine}",
      glow1: "{color.effect.glow1}",
      glow2: "{color.effect.glow2}",
      notebookLine: "{color.effect.notebookLine}",
      notebookMargin: "{color.effect.notebookMargin}",
      terminalGlow: "{color.effect.terminalGlow}",
    },
  },
  radius: {
    panel: "{radius.xl}",
    card: "{radius.lg}",
    input: "{radius.md}",
    button: "{radius.md}",
    pill: "{radius.pill}",
  },
  font: {
    display: 'var(--font-family-display), "Arial Black", sans-serif',
    body: 'var(--font-family-body), system-ui, sans-serif',
    mono: 'var(--font-family-mono), "SFMono-Regular", ui-monospace, monospace',
  },
  type: {
    displayXl: "{typography.displayXl}",
    displayLg: "{typography.displayLg}",
    title: "{typography.title}",
    body: "{typography.body}",
    monoSm: "{typography.monoSm}",
    trackingKicker: "{typography.trackingKicker}",
  },
  layout: {
    content: "{layout.maxWidth}",
    gutter: "{layout.gutter}",
    columnGap: "{layout.columnGap}",
    rowGap: "{layout.rowGap}",
    hero: "{layout.heroPanelHeight}",
  },
  motion: {
    base: "{motion.base}",
    slow: "{motion.slow}",
  },
} satisfies TokenTree;
