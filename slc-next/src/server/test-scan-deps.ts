import { qualityBandForScore } from "@/lib/shared/scans";
import type { LighthouseRunResult } from "@/server/lighthouse";
import { streamOpenAiText } from "@/server/providers/openai/client";

function createMockFetch(): typeof fetch {
  return async (input) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Mock Page for ${url}</title>
          <meta name="description" content="A mock landing page for testing.">
        </head>
        <body>
          <nav><a href="/about">About</a><a href="/pricing">Pricing</a></nav>
          <h1>Transform Your Workflow</h1>
          <section>Trusted by 10,000+ teams worldwide.</section>
          <section>Start your free trial today.</section>
          <footer><a href="/privacy">Privacy</a></footer>
        </body>
      </html>
    `;

    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  };
}

function createMockLighthouse(): (targetUrl: string) => Promise<LighthouseRunResult> {
  return async () => {
    const mobileScore = 61;
    const desktopScore = 71;
    const qualityScore = Math.round((mobileScore + desktopScore) / 2);

    return {
      profiles: {
        mobile: {
          score: mobileScore,
          band: qualityBandForScore(mobileScore),
          snapshot: {
            performance: 55,
            accessibility: 72,
            bestPractices: 68,
            seo: 70,
            strategy: "mobile",
            source: "local",
          },
        },
        desktop: {
          score: desktopScore,
          band: qualityBandForScore(desktopScore),
          snapshot: {
            performance: 69,
            accessibility: 74,
            bestPractices: 70,
            seo: 71,
            strategy: "desktop",
            source: "local",
          },
        },
      },
      qualityScore,
      qualityBand: qualityBandForScore(qualityScore),
      raw: {
        mobile: { categories: {} },
        desktop: { categories: {} },
      },
      status: {
        provider: "lighthouse",
        source: "local",
        reason: "Local Lighthouse completed",
        latencyMs: 50,
      },
    };
  };
}

function createMockStreamText(): typeof streamOpenAiText {
  return async ({ onText }) => {
    const text =
      "This landing page sells workflow transformation to busy teams. The hero is clear but proof is thin. Add testimonials and tighten the CTA. tl;dr: more proof, one CTA.";
    await onText(text);
    return {
      text,
      status: {
        provider: "openai" as const,
        source: "live" as const,
        reason: "Mock OpenAI response for tests",
        model: "gpt-5.4-nano",
        latencyMs: 10,
      },
    };
  };
}

export interface ScanRuntimeDependencies {
  fetchImpl?: typeof fetch;
  runLighthouse?: (targetUrl: string) => Promise<LighthouseRunResult>;
  streamText?: typeof streamOpenAiText;
}

export function buildTestScanDeps(): Partial<ScanRuntimeDependencies> {
  const shouldMock =
    process.env.SLC_MOCK_OPENAI === "true" || process.env.SLC_MOCK_SCAN === "true";

  if (!shouldMock) {
    return {};
  }

  return {
    fetchImpl: createMockFetch(),
    runLighthouse: createMockLighthouse(),
    streamText: createMockStreamText(),
  };
}
