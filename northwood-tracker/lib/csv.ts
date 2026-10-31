// Builds a CSV that opens cleanly in Excel, Numbers, and Google Sheets.

type Cell = string | number | undefined | null;

// Quotes cells with commas, quotes, or line breaks, and neutralizes text
// that a spreadsheet would run as a formula (=, +, -, @). Numbers are left
// alone so negative star balances stay numbers.
function escapeCell(value: Cell): string {
  let text = value === undefined || value === null ? "" : String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(","));
  // The BOM tells Excel the file is UTF-8 (names like "O'Brien" or accents).
  return "﻿" + lines.join("\r\n") + "\r\n";
}
