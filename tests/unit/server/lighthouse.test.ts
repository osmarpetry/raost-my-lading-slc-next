/* @vitest-environment node */

import { existsSync } from "node:fs";

import { vi } from "vitest";

import { runLighthouseAudit } from "@/server/lighthouse";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: vi.fn(actual.existsSync),
  };
});

describe("runLighthouseAudit", () => {
  const originalProvider = process.env.LIGHTHOUSE_PROVIDER;
  const originalChromePath = process.env.CHROME_PATH;

  afterEach(() => {
    vi.unstubAllGlobals();

    if (originalProvider === undefined) {
      delete process.env.LIGHTHOUSE_PROVIDER;
    } else {
      process.env.LIGHTHOUSE_PROVIDER = originalProvider;
    }

    if (originalChromePath === undefined) {
      delete process.env.CHROME_PATH;
    } else {
      process.env.CHROME_PATH = originalChromePath;
    }
  });

  it("fails explicitly when explicit PageSpeed provider errors", async () => {
    process.env.LIGHTHOUSE_PROVIDER = "pagespeed";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ message: "bad" }), { status: 500 })),
    );

    await expect(runLighthouseAudit("https://example.com")).rejects.toThrow(/PageSpeed request failed/);
  });

  it("returns mobile and desktop profiles with PageSpeed when explicitly selected", async () => {
    process.env.LIGHTHOUSE_PROVIDER = "pagespeed";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = typeof input === "string" ? new URL(input) : new URL(input.toString());
        const strategy = url.searchParams.get("strategy");
        const score = strategy === "desktop" ? 0.8 : 0.6;

        return new Response(
          JSON.stringify({
            lighthouseResult: {
              categories: {
                performance: { score },
                accessibility: { score: 0.75 },
                "best-practices": { score: 0.7 },
                seo: { score: 0.78 },
              },
            },
          }),
          { status: 200 },
        );
      }),
    );

    const result = await runLighthouseAudit("https://example.com");

    expect(result.status.source).toBe("pagespeed");
    expect(result.profiles.mobile?.score).toBe(71);
    expect(result.profiles.desktop?.score).toBe(76);
    expect(result.qualityScore).toBe(74);
  });

  it("computes combined score as rounded average of mobile and desktop", async () => {
    process.env.LIGHTHOUSE_PROVIDER = "pagespeed";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = typeof input === "string" ? new URL(input) : new URL(input.toString());
        const strategy = url.searchParams.get("strategy");
        const score = strategy === "desktop" ? 0.9 : 0.5;

        return new Response(
          JSON.stringify({
            lighthouseResult: {
              categories: {
                performance: { score },
                accessibility: { score: 0.75 },
                "best-practices": { score: 0.7 },
                seo: { score: 0.78 },
              },
            },
          }),
          { status: 200 },
        );
      }),
    );

    const result = await runLighthouseAudit("https://example.com");
    const expected = Math.round((result.profiles.mobile!.score + result.profiles.desktop!.score) / 2);
    expect(result.qualityScore).toBe(expected);
  });

  it("fails explicitly when Chrome is missing for local provider", async () => {
    process.env.LIGHTHOUSE_PROVIDER = "local";
    process.env.CHROME_PATH = "/definitely/not/a/real/chrome/path";

    vi.mocked(existsSync).mockReturnValue(false);

    await expect(runLighthouseAudit("https://example.com")).rejects.toThrow(
      /SCAN FAILED · Chrome\/Chromium not found/,
    );
  });

  it("never returns a constant synthetic score without running an audit", async () => {
    process.env.LIGHTHOUSE_PROVIDER = "pagespeed";

    const scores = [0.3, 0.5, 0.7, 0.9];
    for (const mobileScore of scores) {
      for (const desktopScore of scores) {
        vi.stubGlobal(
          "fetch",
          vi.fn(async (input: string | URL) => {
            const url = typeof input === "string" ? new URL(input) : new URL(input.toString());
            const strategy = url.searchParams.get("strategy");
            const score = strategy === "desktop" ? desktopScore : mobileScore;

            return new Response(
              JSON.stringify({
                lighthouseResult: {
                  categories: {
                    performance: { score },
                    accessibility: { score: 0.75 },
                    "best-practices": { score: 0.7 },
                    seo: { score: 0.78 },
                  },
                },
              }),
              { status: 200 },
            );
          }),
        );

        const result = await runLighthouseAudit("https://example.com");
        const mobileProfile = Math.round((mobileScore * 100 + 75 + 70 + 78) / 4);
        const desktopProfile = Math.round((desktopScore * 100 + 75 + 70 + 78) / 4);
        const expected = Math.round((mobileProfile + desktopProfile) / 2);
        expect(result.qualityScore).toBe(expected);
      }
    }
  });
});
