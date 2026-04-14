import { createHash } from "node:crypto";

import type { PageContentSnapshot, SemanticSnapshot } from "@/lib/shared/scans";

function compactLines(values: Array<string | null | undefined>, limit: number) {
  return values
    .map((entry) => entry?.replace(/\s+/g, " ").trim())
    .filter((entry): entry is string => Boolean(entry))
    .slice(0, limit);
}

export function buildSemanticSnapshot(normalizedUrl: string, pages: PageContentSnapshot[]): SemanticSnapshot {
  const homepage = pages[0];
  const hero = homepage?.heroText ?? homepage?.h1 ?? homepage?.title ?? null;
  const mainCta = homepage?.ctaTexts[0] ?? null;
  const proofSummary = compactLines(
    [
      ...pages.flatMap((entry) => entry.proofBlocks),
      ...pages.flatMap((entry) => entry.testimonials),
      ...pages.flatMap((entry) => entry.footerTrustItems),
    ],
    8,
  ).join(" | ") || null;
  const pagesSummary = pages
    .map(
      (page) =>
        `${page.pageKind}:${page.url} title=${page.title ?? "none"} h1=${page.h1 ?? "none"} cta=${page.ctaTexts[0] ?? "none"} snippet=${page.snippet ?? "none"}`,
    )
    .join(" || ");
  const canonicalText = pages
    .map((page) =>
      [
        page.url,
        page.title,
        page.metaDescription,
        page.h1,
        page.headings.join(" | "),
        page.heroText,
        page.ctaTexts.join(" | "),
        page.proofBlocks.join(" | "),
        page.pricingBlocks.join(" | "),
        page.testimonials.join(" | "),
        page.navLabels.join(" | "),
        page.footerTrustItems.join(" | "),
        page.text.slice(0, 2_400),
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n---\n");

  return {
    normalizedUrl,
    selectedPages: pages,
    canonicalText,
    canonicalSummary: compactLines([hero, mainCta, proofSummary, pagesSummary], 4).join("\n"),
    hero,
    mainCta,
    proofSummary,
    pagesSummary,
  };
}

export function computeSnapshotHash(snapshot: SemanticSnapshot) {
  return createHash("sha256").update(snapshot.canonicalText).digest("hex");
}
