import { buildTokenCss } from "@/design/tokens";

describe("design tokens", () => {
  it("generates CSS variables from semantic tokens", () => {
    const css = buildTokenCss();

    expect(css).toContain("--color-surface-app");
    expect(css).toContain("--color-text-primary");
    expect(css).toContain("var(--raw-color-background-base)");
  });
});
