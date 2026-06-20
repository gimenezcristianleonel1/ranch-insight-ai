import * as XLSX from "xlsx";

export type Column<T> = {
  key: keyof T | string;
  header: string;
  get?: (row: T) => unknown;
};

function toRows<T>(items: T[], cols: Column<T>[]) {
  return items.map((row) => {
    const out: Record<string, unknown> = {};
    for (const c of cols) {
      const val = c.get ? c.get(row) : (row as Record<string, unknown>)[c.key as string];
      out[c.header] = val ?? "";
    }
    return out;
  });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportToCsv<T>(items: T[], cols: Column<T>[], filename: string) {
  const rows = toRows(items, cols);
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  triggerDownload(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" }), `${filename}.csv`);
}

export function exportToXlsx<T>(items: T[], cols: Column<T>[], filename: string, sheetName = "Datos") {
  const rows = toRows(items, cols);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  triggerDownload(new Blob([buf], { type: "application/octet-stream" }), `${filename}.xlsx`);
}

export async function parseFile(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { raw: false, defval: "" }) as Record<string, unknown>[];
}

export function pickFile(accept = ".csv,.xlsx,.xls"): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}