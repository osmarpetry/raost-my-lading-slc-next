import { createTerminalLine } from "@/lib/terminal/format";
import type { TerminalLineSeed } from "@/lib/shared/scans";

export function createBootSequence(apiBasePath: string): TerminalLineSeed[] {
  return [
    {
      channel: "prompt",
      text: "roast@landing:~$ boot local-runtime",
      tone: "muted",
      prompt: true,
    },
    createTerminalLine("system", "bootstrapping local scan runtime", { tone: "muted" }),
    createTerminalLine("system", `loading server routes at ${apiBasePath}`, {
      tone: "muted",
    }),
  ];
}

export function createReadyLines(): TerminalLineSeed[] {
  return [
    createTerminalLine("system", "local scan runtime ready", { tone: "success" }),
    createTerminalLine("system", "websocket live stream armed with polling fallback", {
      tone: "muted",
    }),
  ];
}

export function createPromptLine(): TerminalLineSeed {
  return {
    channel: "prompt",
    text: "roast@landing:~$ _",
    tone: "info",
    prompt: true,
  };
}
