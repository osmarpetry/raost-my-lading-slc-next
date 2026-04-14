import { selectPromptPackByScore, scorePromptPacks } from "@/server/pipeline/prompts/score-prompt-packs";

describe("score prompt packs", () => {
  it("covers all score bands plus 100", () => {
    expect(scorePromptPacks).toHaveLength(21);
    expect(selectPromptPackByScore(0).id).toBe("score-0004");
    expect(selectPromptPackByScore(68).id).toBe("score-6569");
    expect(selectPromptPackByScore(100).id).toBe("score-100");
  });
});
