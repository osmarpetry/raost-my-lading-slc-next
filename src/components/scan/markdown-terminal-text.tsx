import type { ReactNode } from "react";

interface MarkdownTerminalTextProps {
  content: string;
}

export function MarkdownTerminalText({ content }: MarkdownTerminalTextProps) {
  const lines = content.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <MarkdownTerminalLine key={i} content={line} />
      ))}
    </>
  );
}

function MarkdownTerminalLine({ content }: { content: string }) {
  // Code block delimiter line
  if (content.startsWith("```")) {
    return (
      <div className="my-0.5 py-0.5 px-1.5 bg-muted/30 rounded text-muted-foreground font-mono text-xs opacity-70">
        {content}
      </div>
    );
  }

  // Heading
  const headingMatch = content.match(/^(#{1,6})\s+(.*)$/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    const sizeClass =
      [
        "text-lg font-bold mt-2 mb-1",
        "text-base font-bold mt-2 mb-1",
        "text-sm font-semibold mt-1.5 mb-0.5",
        "text-sm font-semibold mt-1.5 mb-0.5",
        "text-xs font-semibold mt-1 mb-0.5",
        "text-xs font-semibold mt-1 mb-0",
      ][level - 1] ?? "text-sm font-semibold";
    return <div className={sizeClass}>{parseInline(headingMatch[2])}</div>;
  }

  // List item
  const listMatch = content.match(/^([-*]|\d+\.)\s+(.*)$/);
  if (listMatch) {
    return (
      <div className="flex gap-2 my-0.5 pl-2">
        <span className="text-muted-foreground min-w-[1.25em] select-none text-xs">{listMatch[1]}</span>
        <span className="text-sm">{parseInline(listMatch[2])}</span>
      </div>
    );
  }

  // Blockquote
  const quoteMatch = content.match(/^>\s?(.*)$/);
  if (quoteMatch) {
    return (
      <div className="border-l-2 border-primary/40 pl-3 my-1.5 italic text-muted-foreground text-sm">
        {parseInline(quoteMatch[1])}
      </div>
    );
  }

  // Horizontal rule
  if (/^(---|___|\*\*\*)\s*$/.test(content.trim())) {
    return <hr className="my-2 border-border/40" />;
  }

  // Empty line
  if (!content.trim()) {
    return <div className="h-2" />;
  }

  // Paragraph
  return <div className="my-0.5 text-sm">{parseInline(content)}</div>;
}

function parseInline(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let remaining = text;
  let i = 0;

  while (remaining.length > 0) {
    // Inline code
    const codeMatch = remaining.match(/^(`+)([\s\S]*?)\1/);
    if (codeMatch) {
      parts.push(
        <code key={i++} className="bg-muted px-1 py-0 rounded text-xs font-mono">
          {codeMatch[2]}
        </code>,
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Bold
    const boldMatch = remaining.match(/^\*\*([\s\S]*?)\*\*/);
    if (boldMatch) {
      parts.push(
        <strong key={i++} className="font-semibold">
          {parseInline(boldMatch[1])}
        </strong>,
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic (but not bold)
    const italicMatch = remaining.match(/^\*([\s\S]*?)\*/);
    if (italicMatch) {
      parts.push(
        <em key={i++} className="italic">
          {parseInline(italicMatch[1])}
        </em>,
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Strikethrough
    const strikeMatch = remaining.match(/^~~([\s\S]*?)~~/);
    if (strikeMatch) {
      parts.push(<del key={i++}>{parseInline(strikeMatch[1])}</del>);
      remaining = remaining.slice(strikeMatch[0].length);
      continue;
    }

    // Link
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      parts.push(
        <a
          key={i++}
          href={linkMatch[2]}
          className="text-primary underline hover:opacity-80"
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {linkMatch[1]}
        </a>,
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Plain char
    parts.push(<span key={i++}>{remaining[0]}</span>);
    remaining = remaining.slice(1);
  }

  return <>{parts}</>;
}
