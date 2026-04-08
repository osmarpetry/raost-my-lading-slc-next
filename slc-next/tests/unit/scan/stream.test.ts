import { appendOllamaChunk, flushOllamaStream } from "@/lib/terminal/stream";
import type { TerminalState } from "@/lib/shared/scans";

describe("terminal stream aggregation", () => {
  it("accumulates Ollama chunks into a single streaming line", () => {
    const initial: TerminalState = { lines: [], activeStreamLineId: null, hadOllamaStream: false };
    const started = appendOllamaChunk(initial, "first");
    const updated = appendOllamaChunk(started, " second");

    expect(updated.lines).toHaveLength(1);
    expect(updated.hadOllamaStream).toBe(true);
    expect(updated.lines[0]).toEqual(
      expect.objectContaining({
        channel: "ollama",
        text: "first second",
        streaming: true,
      }),
    );
  });

  it("flushes the active Ollama line when the scan ends", () => {
    const initial: TerminalState = { lines: [], activeStreamLineId: null, hadOllamaStream: false };
    const started = appendOllamaChunk(initial, "partial roast");
    const flushed = flushOllamaStream(started);

    expect(flushed.activeStreamLineId).toBeNull();
    expect(flushed.hadOllamaStream).toBe(true);
    expect(flushed.lines[0]?.streaming).toBe(false);
  });
});
