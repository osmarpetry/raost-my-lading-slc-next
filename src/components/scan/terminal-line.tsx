import { MarkdownTerminalText } from "@/components/scan/markdown-terminal-text";
import type { TerminalLine } from "@/lib/shared/scans";

interface TerminalLineProps {
  line: TerminalLine;
}

export function TerminalLineView({ line }: TerminalLineProps) {
  const isModel = line.channel === "model";
  return (
    <div
      className={`terminal-line terminal-line--${line.channel} terminal-line--${line.tone ?? "info"} ${line.streaming ? "terminal-line--streaming" : ""}`}
    >
      {line.prefix ? <span className="terminal-prefix">{line.prefix}</span> : null}
      {isModel ? (
        <div className="terminal-text terminal-text--markdown">
          <MarkdownTerminalText content={line.text} />
        </div>
      ) : (
        <span className="terminal-text">{line.text}</span>
      )}
    </div>
  );
}
