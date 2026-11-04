"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { safeLink } from "@/lib/safe-url";

// A small, safe Markdown renderer: builds React elements (never raw HTML), so
// content imported from Claude sessions cannot inject markup or scripts.
// Supports headings, paragraphs, lists, fenced code, blockquotes, tables,
// **bold**, *italic*, `code`, and [links](url).

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith("`")) out.push(<code key={key} className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[0.85em]">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("**")) out.push(<strong key={key} className="font-semibold">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("*")) out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    else {
      const [, label, url] = tok.match(/\[([^\]]+)\]\(([^)\s]+)\)/)!;
      const link = safeLink(url);
      if (!link) out.push(label);
      else if (link.kind === "internal") out.push(<Link key={key} href={link.href} className="text-accent-text underline underline-offset-2">{label}</Link>);
      else out.push(<a key={key} href={link.href} target="_blank" rel="noopener noreferrer" className="text-accent-text underline underline-offset-2">{label}</a>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];
    const key = `b${k++}`;

    if (line.startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) body.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={key} dir="ltr" className="overflow-x-auto rounded-lg border border-border bg-surface-2 p-3 font-mono text-[12.5px] leading-relaxed text-fg">
          {body.join("\n")}
        </pre>,
      );
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const cls = ["text-xl font-semibold", "text-lg font-semibold", "text-base font-semibold", "text-sm font-semibold"][level - 1];
      const Tag = (["h2", "h3", "h4", "h5"] as const)[level - 1];
      blocks.push(<Tag key={key} dir="auto" className={cn(cls, "mt-5 text-start text-fg first:mt-0")}>{inline(h[2], key)}</Tag>);
      i++;
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const row = (l: string) => l.trim().slice(1, -1).split("|").map((c) => c.trim());
      const head = row(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(row(lines[i++]));
      blocks.push(
        <div key={key} className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>{head.map((c, j) => <th key={j} dir="auto" className="border-b border-border px-3 py-2 text-start font-semibold">{inline(c, `${key}h${j}`)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>{r.map((c, j) => <td key={j} dir="auto" className="border-b border-border px-3 py-2 text-start align-top">{inline(c, `${key}r${ri}c${j}`)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*([-*]|\d+\.)\s+/, "");
        i++;
        // Indented continuation lines belong to the item.
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i]) && !lines[i].trim().startsWith("```")) {
          item += " " + lines[i].trim();
          i++;
        }
        items.push(item);
      }
      const L = ordered ? "ol" : "ul";
      blocks.push(
        // A list takes the direction of its first item, so bullets and padding stay on the same side.
        <L key={key} dir="auto" className={cn("space-y-1 ps-5 text-start", ordered ? "list-decimal" : "list-disc")}>
          {items.map((it, j) => <li key={j}>{inline(it, `${key}-${j}`)}</li>)}
        </L>,
      );
      continue;
    }
    if (line.startsWith(">")) {
      const body: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) body.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(<blockquote key={key} dir="auto" className="border-s-2 border-border-strong ps-3 text-start text-fg-2">{inline(body.join(" "), key)}</blockquote>);
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|>|\s*([-*]|\d+\.)\s+|\s*\|)/.test(lines[i])) para.push(lines[i++]);
    if (!para.length) para.push(lines[i++]);
    // Single line breaks are kept: AI output often uses them for separate items.
    blocks.push(
      <p key={key} dir="auto" className="text-start">
        {para.map((l, j) => (
          <span key={j}>
            {j > 0 && <br />}
            {inline(l, `${key}-${j}`)}
          </span>
        ))}
      </p>,
    );
  }

  return <div className={cn("space-y-3 text-sm leading-relaxed text-fg", className)}>{blocks}</div>;
}
