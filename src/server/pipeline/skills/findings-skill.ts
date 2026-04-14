import type {
  CategoryFinding,
  LighthouseProfiles,
  SemanticSnapshot,
  SiteUnderstandingSkillOutput,
} from "@/lib/shared/scans";
import type { streamOpenAiText } from "@/server/providers/openai/client";

export interface CategoryFindings {
  marketing: CategoryFinding;
  seo: CategoryFinding;
  performance: CategoryFinding;
}

type StreamTextFn = typeof streamOpenAiText;

function avgLighthouseScore(
  profiles: LighthouseProfiles,
  key: "performance" | "seo" | "accessibility",
): number | null {
  const values = [profiles.mobile, profiles.desktop]
    .map((p) => p?.snapshot[key] ?? null)
    .filter((v): v is number => typeof v === "number");
  if (values.length === 0) return null;
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}

function buildFindingsPrompt({
  snapshot,
  lighthouseProfiles,
  siteUnderstanding,
}: {
  snapshot: SemanticSnapshot;
  lighthouseProfiles: LighthouseProfiles;
  siteUnderstanding: SiteUnderstandingSkillOutput;
}): string {
  const perfScore = avgLighthouseScore(lighthouseProfiles, "performance");
  const seoScore = avgLighthouseScore(lighthouseProfiles, "seo");
  const mobile = lighthouseProfiles.mobile?.snapshot;
  const desktop = lighthouseProfiles.desktop?.snapshot;

  const sitemap = snapshot.selectedPages
    .map(
      (p) =>
        `${p.pageKind === "HOMEPAGE" ? "Homepage" : "Page"}: ${p.url}${p.title ? ` — ${p.title}` : ""}`,
    )
    .join("\n");

  return [
    "SITE SUMMARY",
    `Primary offer: ${siteUnderstanding.primaryOffer}`,
    `Target audience: ${siteUnderstanding.targetAudience.join(", ")}`,
    `Hero: ${snapshot.hero ?? "not detected"}`,
    `Main CTA: ${snapshot.mainCta ?? "not detected"}`,
    `Proof present: ${snapshot.proofSummary ?? "none detected"}`,
    `Evidence missing: ${siteUnderstanding.evidenceMissing.join(", ")}`,
    "",
    "SITEMAP",
    sitemap,
    "",
    "LIGHTHOUSE DATA",
    `Performance: ${perfScore ?? "n/a"} combined (mobile ${mobile?.performance ?? "n/a"}, desktop ${desktop?.performance ?? "n/a"})`,
    `SEO: ${seoScore ?? "n/a"} combined (mobile ${mobile?.seo ?? "n/a"}, desktop ${desktop?.seo ?? "n/a"})`,
    `Accessibility: mobile ${mobile?.accessibility ?? "n/a"}, desktop ${desktop?.accessibility ?? "n/a"}`,
    "",
    "TASK",
    "Write exactly 3 audit findings grounded in the data above, one per domain.",
    "MARKETING: diagnose the main messaging, CTA, proof, or trust gap. Reference the hero, CTA, or missing evidence.",
    "SEO: diagnose a concrete SEO issue using the Lighthouse SEO score and page structure.",
    "PERFORMANCE: diagnose a concrete performance issue using the Lighthouse performance score.",
    "Be specific. Reference actual scores, missing elements, or page structure. No generic advice.",
    "",
    "Respond with this exact JSON and nothing else:",
    `{
  "marketing": {
    "title": "specific marketing/messaging diagnosis",
    "fix": "one concrete action to fix it",
    "severity": "HIGH or MEDIUM"
  },
  "seo": {
    "title": "specific SEO finding grounded in score and page structure",
    "fix": "one concrete SEO action",
    "severity": "HIGH or MEDIUM"
  },
  "performance": {
    "title": "specific performance finding grounded in the score",
    "fix": "one concrete performance action",
    "severity": "HIGH or MEDIUM"
  }
}`,
  ].join("\n");
}

function parseFindings(text: string): CategoryFindings | null {
  try {
    const cleaned = text
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]) as Record<string, unknown>;

    const extractFinding = (raw: unknown): CategoryFinding | null => {
      if (!raw || typeof raw !== "object") return null;
      const r = raw as Record<string, unknown>;
      if (typeof r.title !== "string" || !r.title) return null;
      if (typeof r.fix !== "string" || !r.fix) return null;
      const severity: "HIGH" | "MEDIUM" =
        typeof r.severity === "string" && r.severity.toUpperCase() === "HIGH" ? "HIGH" : "MEDIUM";
      return { title: r.title, fix: r.fix, severity };
    };

    const marketing = extractFinding(parsed.marketing);
    const seo = extractFinding(parsed.seo);
    const performance = extractFinding(parsed.performance);

    if (!marketing || !seo || !performance) return null;

    return { marketing, seo, performance };
  } catch {
    return null;
  }
}

export async function runFindingsSkill({
  snapshot,
  lighthouseProfiles,
  siteUnderstanding,
  streamText,
}: {
  snapshot: SemanticSnapshot;
  lighthouseProfiles: LighthouseProfiles;
  siteUnderstanding: SiteUnderstandingSkillOutput;
  streamText: StreamTextFn;
}): Promise<CategoryFindings | null> {
  const prompt = buildFindingsPrompt({ snapshot, lighthouseProfiles, siteUnderstanding });

  try {
    const { text } = await streamText({
      system:
        "You are a landing page audit specialist. Output valid JSON only. No markdown, no explanation, no code fences.",
      prompt,
      onText: () => {},
    });

    return parseFindings(text);
  } catch {
    return null;
  }
}
