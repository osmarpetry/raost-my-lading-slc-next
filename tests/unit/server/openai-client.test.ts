/* @vitest-environment node */

import { streamOpenAiText } from "@/server/providers/openai/client";

describe("streamOpenAiText", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  });

  it("fails explicitly when OPENAI_API_KEY is missing", async () => {
    delete process.env.OPENAI_API_KEY;

    await expect(
      streamOpenAiText({
        system: "test",
        prompt: "test",
        onText: async () => undefined,
      }),
    ).rejects.toThrow(/OPENAI_API_KEY missing/);
  });
});
