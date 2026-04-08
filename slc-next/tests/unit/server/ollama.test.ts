/* @vitest-environment node */

import { parseOllamaNdjson } from "@/server/ollama";

describe("parseOllamaNdjson", () => {
  it("extracts text deltas from NDJSON", () => {
    const parsed = parseOllamaNdjson(
      [
        JSON.stringify({ response: "Hello ", done: false }),
        JSON.stringify({ response: "world", done: true }),
      ].join("\n"),
    );

    expect(parsed.deltas).toEqual(["Hello ", "world"]);
    expect(parsed.done).toBe(true);
  });
});
