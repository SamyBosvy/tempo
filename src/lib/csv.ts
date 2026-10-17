// CSV helpers: RFC-4180 escaping, UTF-8 BOM so Excel opens accents correctly.

export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const raw = String(v);
  const s = typeof v === 'string' && /^[\s\u0000-\u001f]*[=+\-@]/.test(raw) ? "'" + raw : raw;
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return "﻿" + [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}
