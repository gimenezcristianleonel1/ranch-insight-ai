import * as XLSX from "xlsx";

export type Column<T> = {
  key: keyof T | string;
  header: string;
  get?: (row: T) => unknown;
};

// ─── Export utilities ─────────────────────────────────────────────────────────

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

// ─── Import — CRÍTICO: raw:true para no convertir caravanas a fechas ────────

/**
 * Lee un archivo Excel/CSV y retorna las filas como texto puro.
 *
 * IMPORTANTE:
 * - raw: true → no convierte tipos (evita que "M032" se convierta a fecha)
 * - defval: "" → celdas vacías = string vacío
 * - dateNF: "YYYY-MM-DD" → las columnas que SÍ son fechas se formatean consistentemente
 *
 * El mapeo de columnas a tipos ocurre en el importador, no aquí.
 */
export async function parseFile(file: File): Promise<Record<string, string>[]> {
  const buf = await file.arrayBuffer();

  // Detectar CSV vs Excel
  const isCSV = file.name.toLowerCase().endsWith(".csv");

  const wb = XLSX.read(buf, {
    type: "array",
    raw: true,            // ← No convertir tipos automáticamente
    cellDates: false,     // ← No convertir números seriales a Date
    dateNF: "dd/mm/yyyy", // ← Formato de fecha si hubiera alguna real
  });

  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];

  // Obtener el rango de la hoja
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");

  // Leer encabezados de la fila 0
  const headers: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c })];
    headers.push(cell ? String(cell.v ?? "").trim() : `Col_${c + 1}`);
  }

  // Leer filas (sin la fila de encabezados)
  const rows: Record<string, string>[] = [];
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const row: Record<string, string> = {};
    let hasData = false;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      const header = headers[c - range.s.c];
      if (!header) continue;
      // SIEMPRE tratar como texto. Si la celda tiene valor, lo convertimos a string.
      if (cell) {
        let val = "";
        if (cell.t === "n" && cell.w) {
          // Celda numérica → usar el texto formateado (.w) en lugar del valor (.v)
          // Esto preserva "200626" como "200626" y no como número
          val = String(cell.w).trim();
        } else if (cell.t === "d") {
          // Celda que Excel YA interpretó como fecha → formatear a DD/MM/YYYY
          const d = new Date(cell.v as Date);
          if (!isNaN(d.getTime())) {
            val = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
          } else {
            val = String(cell.w ?? cell.v ?? "").trim();
          }
        } else {
          val = String(cell.v ?? "").trim();
        }
        row[header] = val;
        if (val !== "") hasData = true;
      } else {
        row[header] = "";
      }
    }
    // Saltar filas completamente vacías
    if (hasData) rows.push(row);
  }

  return rows;
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

// ─── Utilidades de fecha para el importador ──────────────────────────────────

/**
 * Parsea una fecha desde múltiples formatos usados en ganadería.
 * Retorna string ISO "YYYY-MM-DD" o null si no puede parsear.
 *
 * Soporta:
 *   DD/MM/YYYY  → 15/06/2024
 *   D/M/YYYY    → 5/6/2024
 *   DDMMYY      → 150624
 *   DDMMYYYY    → 15062024
 *   YYYY-MM-DD  → 2024-06-15 (ISO)
 */
export function parsearFechaGanadera(valor: string): string | null {
  if (!valor || !valor.trim()) return null;
  const v = valor.trim();

  // ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(v + "T00:00:00");
    return isNaN(d.getTime()) ? null : v;
  }

  // DD/MM/YYYY o D/M/YYYY o DD-MM-YYYY
  const dmyMatch = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmyMatch) {
    const [, dd, mm, yyy] = dmyMatch;
    const year = yyy.length === 2 ? (Number(yyy) > 50 ? 1900 + Number(yyy) : 2000 + Number(yyy)) : Number(yyy);
    const d = new Date(year, Number(mm) - 1, Number(dd));
    if (!isNaN(d.getTime()) && d.getFullYear() === year) {
      return `${year}-${String(Number(mm)).padStart(2, "0")}-${String(Number(dd)).padStart(2, "0")}`;
    }
  }

  // DDMMYY (6 dígitos exactos)
  if (/^\d{6}$/.test(v)) {
    const dd = v.slice(0, 2), mm = v.slice(2, 4), yy = v.slice(4, 6);
    const year = Number(yy) > 50 ? 1900 + Number(yy) : 2000 + Number(yy);
    const d = new Date(year, Number(mm) - 1, Number(dd));
    if (!isNaN(d.getTime())) {
      return `${year}-${mm}-${dd}`;
    }
  }

  // DDMMYYYY (8 dígitos exactos)
  if (/^\d{8}$/.test(v)) {
    const dd = v.slice(0, 2), mm = v.slice(2, 4), yyyy = v.slice(4, 8);
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if (!isNaN(d.getTime())) {
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  return null;
}

/**
 * Determina si un string podría ser una caravana (texto alfanumérico ganadero).
 * Usado para advertir al usuario si una columna fecha contiene caravanas.
 */
export function pareceCaravana(valor: string): boolean {
  // Tiene letras seguidas de números, o es alfanumérico corto
  return /^[A-Za-z]+\d+$/.test(valor.trim()) || /^\d+[A-Za-z]+/.test(valor.trim());
}
