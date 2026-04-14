import { buildSemanticSnapshot, computeSnapshotHash } from "@/server/pipeline/steps/build-semantic-snapshot";
import type { PageContentSnapshot } from "@/lib/shared/scans";

function createPage(overrides: Partial<PageContentSnapshot> = {}): PageContentSnapshot {
  return {
    url: "https://example.com/",
    pageKind: "HOMEPAGE",
    statusCode: 200,
    ok: true,
    contentType: "text/html",
    title: "Example",
    metaDescription: "Example description",
    h1: "Example heading",
    headings: ["Example heading"],
    heroText: "Build better pages",
    ctaTexts: ["Start now"],
    proofBlocks: ["Trusted by teams"],
    pricingBlocks: [],
    testimonials: [],
    navLabels: ["About", "Pricing"],
    footerTrustItems: ["Privacy"],
    externalLinks: [],
    snippet: "Build better pages fast.",
    text: "Build better pages fast with proof and clarity.",
    ...overrides,
  };
}

describe("snapshot hashing", () => {
  it("reuses same hash for same semantic content", () => {
    const left = buildSemanticSnapshot("https://example.com/", [createPage()]);
    const right = buildSemanticSnapshot("https://example.com/", [createPage()]);

    expect(computeSnapshotHash(left)).toBe(computeSnapshotHash(right));
  });

  it("changes hash when core offer changes", () => {
    const left = buildSemanticSnapshot("https://example.com/", [createPage()]);
    const right = buildSemanticSnapshot("https://example.com/", [
      createPage({ heroText: "Hire cyber talent faster", text: "Hire cyber talent faster with vetted experts." }),
    ]);

    expect(computeSnapshotHash(left)).not.toBe(computeSnapshotHash(right));
  });
});
