import { readFile } from "node:fs/promises";
import path from "node:path";

// The Debrief Helper's text, read from content/debrief-help.md. Edit that
// file (and rebuild) to change what the page says. Its shape:
//   ## Sensei Debrief Checklist      numbered steps
//   ## 1. White Belt (Subtitle)      one section per belt, numbered by belt_id
//   *Focus: summary*
//   | Level | Focus label | Activities | Concepts |   one row per level
// Text keeps its inline markdown (**bold**, *italic*, `code`).

export type GuideLevel = {
  level: number;
  label: string;
  concepts: string[];
};

export type GuideBelt = {
  belt_id: number;
  title: string; // e.g. "White Belt"
  subtitle: string; // e.g. "Block Coding Foundations"
  summary: string;
  levels: GuideLevel[];
};

export type DebriefGuide = {
  checklist: string[];
  belts: GuideBelt[];
};

const FILE = path.join(process.cwd(), "content", "debrief-help.md");

export async function getDebriefGuide(): Promise<DebriefGuide> {
  return parseDebriefGuide(await readFile(FILE, "utf8"));
}

// Cell text: line breaks, <br>s, and runs of spaces become single spaces.
const clean = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

// Splits a table row on "|", except inside `code` (e.g. `||`).
function splitCells(row: string): string[] {
  const cells = [""];
  let code = false;
  for (const ch of row) {
    if (ch === "`") code = !code;
    if (ch === "|" && !code) cells.push("");
    else cells[cells.length - 1] += ch;
  }
  return cells;
}

export function parseDebriefGuide(markdown: string): DebriefGuide {
  const sections = markdown.split(/^## /m).slice(1);
  const checklist: string[] = [];
  const belts: GuideBelt[] = [];

  for (const section of sections) {
    const [heading, ...rest] = section.split("\n");
    const body = rest.join("\n").replace(/^---\s*$/gm, "");

    if (/checklist/i.test(heading)) {
      for (const m of body.matchAll(/^\s*\d+\.\s+(.+)$/gm)) {
        checklist.push(clean(m[1]));
      }
      continue;
    }

    const belt = heading.match(/^(\d+)\.\s*(.+?)\s*(?:\((.+)\))?\s*$/);
    if (!belt) continue;
    const summary = clean(
      body.match(/^\*Focus:\s*([\s\S]+?)\*\s*$/m)?.[1] ?? "",
    );

    // Table rows start at "| **<level>**"; cells are split by "|".
    const levels: GuideLevel[] = [];
    const table = body.slice(body.search(/^\|\s*\*\*\d+\*\*/m));
    for (const row of table.split(/^\|\s*(?=\*\*\d+\*\*)/m).slice(1)) {
      const cells = splitCells(row).map(clean);
      const level = Number(cells[0]?.replace(/\*/g, ""));
      if (!level) continue;
      levels.push({
        level,
        label: (cells[1] ?? "").replace(/^\*\*(.+)\*\*$/, "$1"),
        concepts: (cells[3] ?? "")
          .split("•")
          .map((c) => c.trim())
          .filter(Boolean),
      });
    }

    belts.push({
      belt_id: Number(belt[1]),
      title: belt[2],
      subtitle: belt[3] ?? "",
      summary,
      levels,
    });
  }
  return { checklist, belts };
}
