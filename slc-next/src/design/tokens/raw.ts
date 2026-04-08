import type { TokenTree } from "./types";

export const rawTokens = {
  color: {
    background: {
      base: "#f1ebd9",
      elevated: "#f7f2e4",
    },
    surface: {
      paper: "#fffaf0",
      terminal: "#101621",
      terminalTopbar: "rgba(12, 16, 27, 0.96)",
    },
    border: {
      soft: "rgba(73, 58, 31, 0.12)",
      strong: "rgba(27, 36, 54, 0.2)",
    },
    text: {
      primary: "#1d170f",
      secondary: "rgba(29, 23, 15, 0.66)",
      inverse: "#eef5ee",
    },
    accent: {
      olive: "#536940",
      oliveDeep: "#213121",
      red: "#9c4339",
      warning: "#be8253",
      success: "#488662",
      info: "#77bfd7",
    },
    effect: {
      gridLine: "rgba(97, 86, 63, 0.06)",
      glow1: "rgba(228, 208, 142, 0.38)",
      glow2: "rgba(120, 149, 91, 0.18)",
      notebookLine: "rgba(92, 127, 181, 0.16)",
      notebookMargin: "rgba(156, 67, 57, 0.2)",
      terminalGlow: "rgba(82, 133, 103, 0.14)",
      statusIdle: "rgba(92, 81, 58, 0.16)",
      statusLive: "rgba(72, 134, 98, 0.16)",
      statusError: "rgba(156, 67, 57, 0.16)",
    },
  },
  spacing: {
    1: "0.25rem",
    2: "0.5rem",
    3: "0.75rem",
    4: "1rem",
    5: "1.5rem",
    6: "2rem",
    7: "3rem",
    8: "4rem",
  },
  radius: {
    sm: "14px",
    md: "22px",
    lg: "32px",
    xl: "40px",
    pill: "999px",
  },
  shadow: {
    paper: "0 24px 60px rgba(110, 89, 54, 0.18)",
    panel: "0 28px 80px rgba(22, 18, 13, 0.16)",
    float: "0 18px 40px rgba(31, 24, 14, 0.12)",
  },
  typography: {
    displayXl: "clamp(3.2rem, 8vw, 6.4rem)",
    displayLg: "clamp(2.6rem, 6vw, 4.8rem)",
    title: "clamp(1.8rem, 4vw, 2.9rem)",
    body: "1rem",
    monoSm: "0.78rem",
    trackingKicker: "0.18em",
  },
  layout: {
    maxWidth: "1680px",
    gutter: "clamp(16px, 3vw, 32px)",
    columnGap: "clamp(20px, 3vw, 32px)",
    rowGap: "clamp(22px, 4vw, 40px)",
    heroPanelHeight: "clamp(560px, 76dvh, 820px)",
  },
  motion: {
    base: "180ms ease",
    slow: "260ms ease",
  },
} satisfies TokenTree;
