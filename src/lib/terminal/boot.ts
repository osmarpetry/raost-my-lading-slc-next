import { createTerminalLine } from "@/lib/terminal/format";
import type { TerminalLineSeed } from "@/lib/shared/scans";

export function createBootSequence(apiBasePath: string): TerminalLineSeed[] {
  return [
    {
      channel: "prompt",
      text: "slc@truth:~$ boot scan-runtime",
      tone: "muted",
      prompt: true,
    },
    createTerminalLine("system", "booting truthful scan runtime", { tone: "muted" }),
    createTerminalLine("system", `loading server routes at ${apiBasePath}`, {
      tone: "muted",
    }),
  ];
}

export function createReadyLines(): TerminalLineSeed[] {
  return [
    createTerminalLine("system", "truthful scan runtime ready", { tone: "success" }),
    createTerminalLine("system", "websocket live stream active with HTTP recovery", {
      tone: "muted",
    }),
  ];
}

export function createPromptLine(): TerminalLineSeed {
  return {
    channel: "prompt",
    text: "slc@truth:~$ _",
    tone: "info",
    prompt: true,
  };
}
