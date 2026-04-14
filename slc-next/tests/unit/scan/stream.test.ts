import { appendModelChunk, flushModelStream } from "@/lib/terminal/stream";
import type { TerminalState } from "@/lib/shared/scans";

describe("terminal stream aggregation", () => {
  it("accumulates model chunks into a single streaming line", () => {
    const initial: TerminalState = { lines: [], activeStreamLineId: null, hadModelStream: false };
    const started = appendModelChunk(initial, "first");
    const updated = appendModelChunk(started, " second");

    expect(updated.lines).toHaveLength(1);
    expect(updated.hadModelStream).toBe(true);
    expect(updated.lines[0]).toEqual(
      expect.objectContaining({
        channel: "model",
        text: "first second",
        streaming: true,
      }),
    );
  });

  it("flushes active model line when scan ends", () => {
    const initial: TerminalState = { lines: [], activeStreamLineId: null, hadModelStream: false };
    const started = appendModelChunk(initial, "partial roast");
    const flushed = flushModelStream(started);

    expect(flushed.activeStreamLineId).toBeNull();
    expect(flushed.hadModelStream).toBe(true);
    expect(flushed.lines[0]?.streaming).toBe(false);
  });
});
