import type {
  FinalRoastPayload,
  LighthouseInterpretationSkillOutput,
  PromptPack,
  SemanticSnapshot,
  SiteUnderstandingSkillOutput,
} from "@/lib/shared/scans";
import type { CategoryFindings } from "@/server/pipeline/skills/findings-skill";

export function buildMergedPrompt({
  promptPack,
  snapshot,
  siteUnderstanding,
  lighthouseInterpretation,
}: {
  promptPack: PromptPack;
  snapshot: SemanticSnapshot;
  siteUnderstanding: SiteUnderstandingSkillOutput;
  lighthouseInterpretation: LighthouseInterpretationSkillOutput;
}) {
  return [
    "ROLE",
    "You are Roast My Landing reviewer.",
    "Write direct editorial feedback for founder reading terminal output.",
    "Stay inside current business scope. Never invent new offer, new audience, or pivot.",
    "Be specific. No JSON. No markdown bullets. Short paragraphs only.",
    "",
    "SCORE PACK",
    promptPack.fixedInstructionBlock,
    `Tone: ${promptPack.tone}`,
    `Urgency: ${promptPack.urgency}`,
    `Forbidden: ${promptPack.forbiddenMoves.join("; ")}`,
    "",
    "SITE UNDERSTANDING",
    siteUnderstanding.summary,
    `Primary offer: ${siteUnderstanding.primaryOffer}`,
    `Target audience: ${siteUnderstanding.targetAudience.join(", ")}`,
    `Likely conversion goal: ${siteUnderstanding.likelyConversionGoal}`,
    `Evidence present: ${siteUnderstanding.evidencePresent.join(" | ") || "none"}`,
    `Evidence missing: ${siteUnderstanding.evidenceMissing.join(" | ") || "none"}`,
    `Compliments seed: ${siteUnderstanding.compliments.join(" | ")}`,
    `Priority fixes seed: ${siteUnderstanding.priorityFixes.join(" | ")}`,
    `Quick wins seed: ${siteUnderstanding.quickWins0to3Days.join(" | ") || "none"}`,
    "",
    "PERFORMANCE INTERPRETATION",
    lighthouseInterpretation.summary,
    `Conversion risk: ${lighthouseInterpretation.conversionRisk}`,
    `Top narratives: ${lighthouseInterpretation.topPerformanceNarratives.join(" | ")}`,
    "",
    "SITE SNAPSHOT",
    `Hero: ${snapshot.hero ?? "unknown"}`,
    `Main CTA: ${snapshot.mainCta ?? "unknown"}`,
    `Proof blocks: ${snapshot.proofSummary ?? "none"}`,
    `Top pages summary: ${snapshot.pagesSummary}`,
    "",
    "NORMALIZED EXTRACTED PAGE TEXT",
    snapshot.canonicalText.slice(0, 3_000),
    "",
    "OUTPUT RULES",
    "- Open with strongest diagnosis",
    "- Mention what already works before fixes",
    "- Give 3 clearest priorities, not a laundry list",
    "- Keep final paragraph short and end with tl;dr:",
  ].join("\n");
}

export function buildFinalRoastPayload({
  snapshotHash,
  promptPackId,
  siteUnderstanding,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  lighthouseInterpretation: _lighthouseInterpretation,
  finalText,
  categoryFindings,
}: {
  snapshotHash: string;
  promptPackId: string;
  siteUnderstanding: SiteUnderstandingSkillOutput;
  lighthouseInterpretation: LighthouseInterpretationSkillOutput;
  finalText: string;
  categoryFindings?: CategoryFindings | null;
}): FinalRoastPayload {
  return {
    headlineDiagnosis: siteUnderstanding.priorityFixes[0],
    whatSiteSells: siteUnderstanding.primaryOffer,
    whoItTargets: siteUnderstanding.targetAudience,
    compliments: siteUnderstanding.compliments,
    priorityFixes: siteUnderstanding.priorityFixes,
    quickWins0to3Days: siteUnderstanding.quickWins0to3Days.slice(0, 3),
    finalRoast: finalText,
    confidence: Math.max(0.7, siteUnderstanding.confidence),
    usedSnapshotHash: snapshotHash,
    usedPromptPackId: promptPackId,
    usedSources: ["siteUnderstanding", "lighthouseInterpretation", "snapshot", "openai"],
    finalText: finalText.trim(),
    categoryFindings: categoryFindings ?? null,
  };
}
