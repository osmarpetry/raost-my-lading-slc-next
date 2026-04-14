import { scorePromptPacks } from "@/server/pipeline/prompts/score-prompt-packs";

export const promptPackExamples = scorePromptPacks.map((pack) => ({
  id: pack.id,
  example: [
    "ROLE",
    "You are Roast My Landing reviewer. Be playful but professional.",
    "",
    "SCORE PACK",
    pack.fixedInstructionBlock,
    `Tone: ${pack.tone}`,
    `Urgency: ${pack.urgency}`,
    `Forbidden moves: ${pack.forbiddenMoves.join("; ")}`,
    "",
    "OUTPUT RULES",
    "- Give 3 compliments",
    "- Give 3 priority fixes",
    "- Give 0 to 3 quick wins",
    "- End with tl;dr roast",
  ].join("\n"),
}));
