/* @vitest-environment node */

import {
  scanArtifactsResponseSchema,
  scanJobSchema,
} from "@/lib/shared/scans";

describe("Postgres store schema round-trips", () => {
  it("scanJobSchema accepts a fully hydrated run with Lighthouse profiles and provider status", () => {
    const raw = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      persistedRunId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      persistedState: "persisted",
      url: "https://example.com",
      normalizedUrl: "https://example.com/",
      rootUrl: "https://example.com/",
      analysisId: null,
      snapshotHash: "abc123",
      cacheState: "fresh",
      currentStep: "COMPLETED",
      finalResponseState: "COMPLETED",
      status: "COMPLETED",
      errorMessage: null,
      previewRoast: "Preview text.",
      fullRoast: "Full roast text.",
      qualityScore: 74,
      qualityBand: "PASSABLE",
      providerStatus: {
        lighthouse: {
          provider: "lighthouse",
          source: "local",
          reason: "Local Lighthouse completed",
          latencyMs: 1200,
        },
        openai: {
          provider: "openai",
          source: "live",
          reason: "OpenAI final synthesis completed",
          model: "gpt-5.4-nano",
          latencyMs: 800,
        },
      },
      lighthouseProfiles: {
        mobile: {
          score: 71,
          band: "PASSABLE",
          snapshot: {
            performance: 65,
            accessibility: 75,
            bestPractices: 70,
            seo: 74,
            strategy: "mobile",
            source: "local",
            fetchedAt: "2026-01-01T00:00:00.000Z",
          },
        },
        desktop: {
          score: 77,
          band: "STRONG",
          snapshot: {
            performance: 76,
            accessibility: 78,
            bestPractices: 75,
            seo: 79,
            strategy: "desktop",
            source: "local",
            fetchedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
      siteUnderstanding: {
        siteType: "SAAS",
        primaryOffer: "Workflow software",
        secondaryOffers: ["Integrations"],
        targetAudience: ["Founders"],
        userIntent: "Save time",
        brandVoice: "Direct",
        coreTopics: ["Productivity"],
        evidencePresent: ["Testimonials"],
        evidenceMissing: ["Pricing"],
        likelyConversionGoal: "START_TRIAL",
        businessUnderstandingScore: 72,
        clarityScore: 68,
        trustScore: 70,
        seoMessageFitScore: 65,
        compliments: ["Good hero", "Clear CTA", "Strong proof"],
        priorityFixes: ["Add pricing", "Tighten headline", "More social proof"],
        quickWins0to3Days: ["Add testimonials", "Fix CTA color"],
        summary: "Solid SaaS landing with room to improve proof.",
        confidence: 0.82,
      },
      lighthouseInterpretation: {
        scoreBandId: "passable",
        severity: "MEDIUM",
        summary: "Performance is acceptable but not competitive.",
        conversionRisk: "Moderate bounce risk on mobile.",
        topPerformanceNarratives: ["LCP is okay", "CLS is clean"],
        quickFixIdeas: ["Compress images", "Preload hero"],
      },
      finalPayload: {
        headlineDiagnosis: "Headline is vague.",
        whatSiteSells: "Workflow software",
        whoItTargets: ["Founders"],
        compliments: ["Good hero", "Clear CTA", "Strong proof"],
        priorityFixes: ["Add pricing", "Tighten headline", "More social proof"],
        quickWins0to3Days: ["Add testimonials", "Fix CTA color"],
        finalRoast: "Tighten headline and bring proof higher.",
        confidence: 0.82,
        usedSnapshotHash: "abc123",
        usedPromptPackId: "pack-passable",
        usedSources: ["snapshot", "lighthouse", "openai"],
        finalText: "Tighten headline and bring proof higher. tl;dr: headline + proof.",
      },
      findings: [
        {
          code: "PRICING",
          severity: "HIGH",
          title: "Pricing is missing",
          problem: "Users can't evaluate cost.",
          why: "Friction before trial.",
          fix: "Add transparent pricing.",
          impact: "Higher trial starts.",
          roastLine: "Visitors guess the price.",
        },
      ],
      events: [
        {
          scanId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          seq: 1,
          eventType: "SCAN_STAGE",
          stage: "RUNNING",
          message: "Scan started",
          payloadJson: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const parsed = scanJobSchema.parse(raw);
    expect(parsed.lighthouseProfiles.mobile?.score).toBe(71);
    expect(parsed.lighthouseProfiles.desktop?.score).toBe(77);
    expect(parsed.providerStatus.lighthouse.source).toBe("local");
    expect(parsed.providerStatus.openai.source).toBe("live");
  });

  it("scanArtifactsResponseSchema round-trips all JSONB artifact fields", () => {
    const raw = {
      run: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        persistedRunId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        persistedState: "persisted",
        url: "https://example.com",
        normalizedUrl: "https://example.com/",
        rootUrl: "https://example.com/",
        analysisId: null,
        snapshotHash: "abc123",
        cacheState: "fresh",
        currentStep: "COMPLETED",
        finalResponseState: "COMPLETED",
        status: "COMPLETED",
        errorMessage: null,
        previewRoast: "Preview text.",
        fullRoast: "Full roast text.",
        qualityScore: 74,
        qualityBand: "PASSABLE",
        providerStatus: {
          lighthouse: {
            provider: "lighthouse",
            source: "local",
            reason: "Local Lighthouse completed",
            latencyMs: 1200,
          },
          openai: {
            provider: "openai",
            source: "live",
            reason: "OpenAI final synthesis completed",
            model: "gpt-5.4-nano",
            latencyMs: 800,
          },
        },
        lighthouseProfiles: {
          mobile: {
            score: 71,
            band: "PASSABLE",
            snapshot: {
              performance: 65,
              accessibility: 75,
              bestPractices: 70,
              seo: 74,
              strategy: "mobile",
              source: "local",
              fetchedAt: "2026-01-01T00:00:00.000Z",
            },
          },
          desktop: {
            score: 77,
            band: "STRONG",
            snapshot: {
              performance: 76,
              accessibility: 78,
              bestPractices: 75,
              seo: 79,
              strategy: "desktop",
              source: "local",
              fetchedAt: "2026-01-01T00:00:00.000Z",
            },
          },
        },
        siteUnderstanding: null,
        lighthouseInterpretation: null,
        finalPayload: null,
        findings: [],
        events: [],
      },
      routeMapJson: {
        rootUrl: "https://example.com/",
        scannedUrls: ["https://example.com/"],
        childUrls: ["https://example.com/about"],
      },
      pagesJson: [
        {
          url: "https://example.com/",
          pageKind: "HOMEPAGE",
          statusCode: 200,
          ok: true,
          contentType: "text/html",
          title: "Example",
          metaDescription: "Example page",
          h1: "Welcome",
          headings: ["Welcome"],
          heroText: "Welcome",
          ctaTexts: ["Sign up"],
          proofBlocks: [],
          pricingBlocks: [],
          testimonials: [],
          navLabels: ["About"],
          footerTrustItems: [],
          externalLinks: [],
          snippet: "Welcome to Example.",
          text: "Welcome to Example.",
        },
      ],
      externalLinksJson: [],
      lighthouseMobileJson: { categories: { performance: { score: 0.65 } } },
      lighthouseDesktopJson: { categories: { performance: { score: 0.76 } } },
      siteUnderstandingJson: null,
      finalPayloadJson: null,
      eventLog: [],
    };

    const parsed = scanArtifactsResponseSchema.parse(raw);
    expect(parsed.lighthouseMobileJson).toEqual(raw.lighthouseMobileJson);
    expect(parsed.lighthouseDesktopJson).toEqual(raw.lighthouseDesktopJson);
    expect(parsed.routeMapJson).toEqual(raw.routeMapJson);
  });
});
