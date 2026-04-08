import type { TerminalLineSeed, TerminalState } from "@/lib/shared/scans";

let fallbackLineId = 0;

function createLineId() {
  const uuid = globalThis.crypto?.randomUUID;
  if (typeof uuid === "function") {
    return uuid.call(globalThis.crypto);
  }

  fallbackLineId += 1;
  return `line-${Date.now().toString(36)}-${fallbackLineId.toString(36)}`;
}

function lineWithId(line: TerminalLineSeed) {
  return {
    ...line,
    id: createLineId(),
  };
}

export function addTerminalLines(state: TerminalState, lines: TerminalLineSeed[]): TerminalState {
  return {
    ...state,
    lines: [...state.lines, ...lines.map(lineWithId)],
  };
}

export function dismissPrompt(state: TerminalState): TerminalState {
  return {
    ...state,
    lines: state.lines.filter((line) => !line.prompt),
  };
}

export function appendOllamaChunk(state: TerminalState, chunk: string): TerminalState {
  if (!chunk) {
    return state;
  }

  if (state.activeStreamLineId) {
    return {
      ...state,
      lines: state.lines.map((line) =>
        line.id === state.activeStreamLineId ? { ...line, text: `${line.text}${chunk}` } : line,
      ),
      hadOllamaStream: true,
    };
  }

  const streamLine = lineWithId({
    channel: "ollama",
    prefix: "[ollama]",
    text: chunk,
    tone: "success",
    streaming: true,
  });

  return {
    ...state,
    activeStreamLineId: streamLine.id,
    hadOllamaStream: true,
    lines: [...state.lines, streamLine],
  };
}

export function flushOllamaStream(state: TerminalState): TerminalState {
  if (!state.activeStreamLineId) {
    return state;
  }

  return {
    ...state,
    activeStreamLineId: null,
    lines: state.lines.map((line) =>
      line.id === state.activeStreamLineId ? { ...line, streaming: false } : line,
    ),
  };
}
