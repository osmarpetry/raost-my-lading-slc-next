import type { PromptPack } from "@/lib/shared/scans";

function createPack(minScore: number, maxScore: number): PromptPack {
  const id =
    minScore === 100
      ? "score-100"
      : `score-${String(minScore).padStart(2, "0")}${String(maxScore).padStart(2, "0")}`;

  if (maxScore <= 19) {
    return {
      id,
      minScore,
      maxScore,
      tone: "brutal",
      urgency: "critical",
      focusWeights: { clarity: 0.3, trust: 0.25, proof: 0.2, speed: 0.2, seo: 0.05 },
      fixedInstructionBlock:
        "Site under severe pressure. Prioritize breakage, trust gaps, clarity gaps, and fastest rescue moves. Keep advice inside current offer.",
      forbiddenMoves: ["Invent new product", "Suggest full rebrand", "Give generic SaaS advice"],
    };
  }

  if (maxScore <= 39) {
    return {
      id,
      minScore,
      maxScore,
      tone: "sharp",
      urgency: "high",
      focusWeights: { clarity: 0.3, trust: 0.3, proof: 0.2, speed: 0.15, seo: 0.05 },
      fixedInstructionBlock:
        "Site weak. Push for trust repair, proof, clearer message, and 0-3 day fixes. Stay strict about business scope.",
      forbiddenMoves: ["Invent new audience", "Suggest pivot", "Use fluffy praise"],
    };
  }

  if (maxScore <= 59) {
    return {
      id,
      minScore,
      maxScore,
      tone: "sharp",
      urgency: "high",
      focusWeights: { clarity: 0.25, trust: 0.3, proof: 0.25, speed: 0.1, seo: 0.1 },
      fixedInstructionBlock:
        "Site serviceable but leaks confidence. Prioritize proof, stronger promise, and CTA support. No generic boilerplate advice.",
      forbiddenMoves: ["Suggest redesign from scratch", "Ignore existing proof", "Invent features"],
    };
  }

  if (maxScore <= 79) {
    return {
      id,
      minScore,
      maxScore,
      tone: "direct",
      urgency: "medium",
      focusWeights: { clarity: 0.3, trust: 0.3, proof: 0.25, speed: 0.1, seo: 0.05 },
      fixedInstructionBlock:
        "Site decent. Focus on sharper evidence, stronger differentiation, better message fit, and practical wins within 3 days.",
      forbiddenMoves: ["Be overly negative", "Ignore current strengths", "Give category-mismatched advice"],
    };
  }

  return {
    id,
    minScore,
    maxScore,
    tone: "polished",
    urgency: "low",
    focusWeights: { clarity: 0.25, trust: 0.25, proof: 0.25, speed: 0.1, seo: 0.15 },
    fixedInstructionBlock:
      "Site strong. Preserve what works. Focus on leverage, proof amplification, and precision improvements only.",
    forbiddenMoves: ["Force fake urgency", "Suggest radical changes", "Ignore consistency with existing site"],
  };
}

export const scorePromptPacks: PromptPack[] = [
  ...Array.from({ length: 20 }, (_entry, index) => {
    const minScore = index * 5;
    const maxScore = index * 5 + 4;
    return createPack(minScore, maxScore);
  }),
  createPack(100, 100),
];

export function selectPromptPackByScore(score: number) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  return (
    scorePromptPacks.find((entry) => safeScore >= entry.minScore && safeScore <= entry.maxScore) ??
    scorePromptPacks[0]
  );
}
