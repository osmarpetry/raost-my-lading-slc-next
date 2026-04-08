import type { TerminalLine } from "@/lib/shared/scans";

interface TerminalLineProps {
  line: TerminalLine;
}

export function TerminalLineView({ line }: TerminalLineProps) {
  return (
    <div
      className={`terminal-line terminal-line--${line.channel} terminal-line--${line.tone ?? "info"} ${line.streaming ? "terminal-line--streaming" : ""}`}
    >
      {line.prefix ? <span className="terminal-prefix">{line.prefix}</span> : null}
      <span className="terminal-text">{line.text}</span>
    </div>
  );
}
