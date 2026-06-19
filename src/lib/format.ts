export function fmtNum(n: number | null | undefined, decimals = 0) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function fmtPct(n: number | null | undefined, decimals = 1) {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  return `${fmtNum(n, decimals)}%`;
}

export function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-AR");
}