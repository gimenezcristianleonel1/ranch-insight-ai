/**
 * pdf-reports.ts
 * Generación de informes PDF descargables usando solo recursos del navegador.
 * No requiere librerías externas — genera HTML → ventana de impresión → PDF.
 */

import { supabase } from "@/integrations/supabase/client";
import { fmtNum, fmtPct, fmtDate } from "@/lib/format";

// ─── Helper: abrir ventana de impresión con HTML ──────────────────────────────

function abrirPDF(titulo: string, html: string) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) { alert("Habilitá ventanas emergentes para generar el PDF"); return; }

  win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${titulo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 20px 28px; }
    h1 { font-size: 22px; font-weight: 700; color: #1a1a1a; margin-bottom: 2px; }
    h2 { font-size: 15px; font-weight: 600; color: #333; margin: 18px 0 8px; border-bottom: 1.5px solid #ddd; padding-bottom: 4px; }
    h3 { font-size: 13px; font-weight: 600; color: #444; margin: 12px 0 6px; }
    .meta { font-size: 11px; color: #666; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 11.5px; }
    th { background: #f3f4f6; text-align: left; padding: 5px 8px; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
    td { padding: 4px 8px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    tr:nth-child(even) td { background: #fafafa; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
    .kpi { border: 1.5px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; }
    .kpi-val { font-size: 22px; font-weight: 700; color: #1a1a1a; }
    .kpi-lbl { font-size: 10px; color: #666; margin-top: 2px; text-transform: uppercase; letter-spacing: .04em; }
    .badge { display: inline-block; padding: 1px 7px; border-radius: 4px; font-size: 10px; font-weight: 600; }
    .badge-ok { background: #d1fae5; color: #065f46; }
    .badge-warn { background: #fef3c7; color: #92400e; }
    .badge-err { background: #fee2e2; color: #991b1b; }
    footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 10px; color: #888; text-align: center; }
    @media print {
      body { padding: 10px 15px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="background:#1d4ed8;color:white;padding:10px 16px;border-radius:8px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-weight:600">📄 Informe listo — Usá Archivo → Imprimir para guardar como PDF</span>
    <button onclick="window.print()" style="background:white;color:#1d4ed8;border:none;padding:6px 16px;border-radius:5px;font-weight:700;cursor:pointer;font-size:13px">
      Imprimir / Guardar PDF
    </button>
  </div>
  ${html}
  <footer>Generado el ${new Date().toLocaleDateString("es-AR")} — Sistema de Gestión Ganadera</footer>
</body>
</html>`);
  win.document.close();
}

// ─── 1. Informe de Rodeo ──────────────────────────────────────────────────────

export async function generarInformeRodeo(estId: string, estNombre: string) {
  const [{ data: animales }, { data: cats }, { data: potreros }] = await Promise.all([
    supabase.from("animales")
      .select("id, caravana, sexo, peso_actual, estado_reproductivo, categoria:categorias(nombre, ev), raza:razas(nombre), potrero:potreros(nombre)")
      .eq("establecimiento_id", estId).eq("estado", "activo").order("caravana"),
    supabase.from("categorias").select("id, nombre, ev").order("nombre"),
    supabase.from("potreros").select("id, nombre, hectareas").eq("establecimiento_id", estId).order("nombre"),
  ]);

  const animalesData = (animales ?? []) as any[];
  const totalEV = animalesData.reduce((s, a) => s + (a.categoria?.ev ?? 1), 0);
  const totalHa = (potreros ?? []).reduce((s, p) => s + Number(p.hectareas), 0);

  // Agrupar por categoría
  const porCat: Record<string, { machos: number; hembras: number; ev: number }> = {};
  for (const a of animalesData) {
    const cat = a.categoria?.nombre ?? "Sin categoría";
    if (!porCat[cat]) porCat[cat] = { machos: 0, hembras: 0, ev: 0 };
    if (a.sexo === "macho") porCat[cat].machos++;
    else porCat[cat].hembras++;
    porCat[cat].ev += a.categoria?.ev ?? 1;
  }

  const rows = Object.entries(porCat)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cat, d]) => `
      <tr>
        <td>${cat}</td>
        <td style="text-align:center">${d.machos || "—"}</td>
        <td style="text-align:center">${d.hembras || "—"}</td>
        <td style="text-align:right;font-weight:600">${d.machos + d.hembras}</td>
        <td style="text-align:right">${fmtNum(d.ev, 1)}</td>
      </tr>`).join("");

  const html = `
    <h1>${estNombre}</h1>
    <div class="meta">Informe de Rodeo — ${new Date().toLocaleDateString("es-AR")}</div>
    <div class="kpis">
      <div class="kpi"><div class="kpi-val">${animalesData.length}</div><div class="kpi-lbl">Stock total</div></div>
      <div class="kpi"><div class="kpi-val">${fmtNum(totalEV, 1)}</div><div class="kpi-lbl">EV totales</div></div>
      <div class="kpi"><div class="kpi-val">${fmtNum(totalHa > 0 ? totalEV / totalHa : 0, 2)}</div><div class="kpi-lbl">EV / ha</div></div>
      <div class="kpi"><div class="kpi-val">${(potreros ?? []).length}</div><div class="kpi-lbl">Potreros</div></div>
    </div>
    <h2>Stock por categoría</h2>
    <table>
      <thead><tr><th>Categoría</th><th style="text-align:center">♂ Machos</th><th style="text-align:center">♀ Hembras</th><th style="text-align:right">Total</th><th style="text-align:right">EV</th></tr></thead>
      <tbody>${rows}
        <tr style="font-weight:700;background:#f9fafb;">
          <td>TOTAL</td>
          <td style="text-align:center">${animalesData.filter(a => a.sexo === "macho").length}</td>
          <td style="text-align:center">${animalesData.filter(a => a.sexo !== "macho").length}</td>
          <td style="text-align:right">${animalesData.length}</td>
          <td style="text-align:right">${fmtNum(totalEV, 1)}</td>
        </tr>
      </tbody>
    </table>
    <h2>Listado completo (${animalesData.length} animales)</h2>
    <table>
      <thead><tr><th>Fecha</th><th>Categoría</th><th>Sexo</th><th>Raza</th><th>Potrero</th><th>Estado reprod.</th><th style="text-align:right">Peso (kg)</th></tr></thead>
      <tbody>
        ${animalesData.map(a => `
          <tr>
            <td style="font-family:monospace;font-weight:600">${a.caravana}</td>
            <td>${a.categoria?.nombre ?? "—"}</td>
            <td>${a.sexo === "macho" ? "♂" : "♀"}</td>
            <td>${a.raza?.nombre ?? "—"}</td>
            <td>${a.potrero?.nombre ?? "—"}</td>
            <td class="${a.estado_reproductivo === "prenada" ? "badge badge-ok" : ""}">${a.estado_reproductivo ?? "—"}</td>
            <td style="text-align:right;font-family:monospace">${a.peso_actual ? fmtNum(a.peso_actual, 1) : "—"}</td>
          </tr>`).join("")}
      </tbody>
    </table>`;

  abrirPDF(`Rodeo ${estNombre}`, html);
}

// ─── 2. Informe Reproductivo ──────────────────────────────────────────────────

export async function generarInformeReproductivo(estId: string, estNombre: string) {
  const since = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [{ data: servicios }, { data: tactos }, { data: pariciones }, { data: destetes }, { data: abortos }] = await Promise.all([
    supabase.from("servicios").select("id, tipo, fecha, vaca_id, animales!vaca_id(caravana)").eq("establecimiento_id", estId).gte("fecha", since).order("fecha", { ascending: false }),
    supabase.from("diagnosticos").select("id, resultado, edad_fetal_dias, fecha, vaca_id, animales!vaca_id(caravana)").eq("establecimiento_id", estId).gte("fecha", since).order("fecha", { ascending: false }),
    supabase.from("pariciones").select("id, vivo, sexo_cria, peso_nacimiento, fecha, vaca_id, animales!vaca_id(caravana)").eq("establecimiento_id", estId).gte("fecha", since).order("fecha", { ascending: false }),
    supabase.from("destetes").select("id, peso_destete, fecha, cria_id, animales!cria_id(caravana)").eq("establecimiento_id", estId).gte("fecha", since).order("fecha", { ascending: false }),
    supabase.from("abortos").select("id, fecha, vaca_id, animales!vaca_id(caravana)").eq("establecimiento_id", estId).gte("fecha", since).order("fecha", { ascending: false }),
  ]);

  const srv = (servicios ?? []) as any[];
  const tac = (tactos ?? []) as any[];
  const par = (pariciones ?? []) as any[];
  const dest = (destetes ?? []) as any[];

  const entoradas = new Set(srv.map(s => s.vaca_id)).size;
  const prenadas = tac.filter(t => t.resultado).length;
  const tacTotales = tac.length;
  const parVivas = par.filter(p => p.vivo).length;
  const pctPrenez = entoradas > 0 ? (prenadas / entoradas) * 100 : 0;
  const pctPar = entoradas > 0 ? (parVivas / entoradas) * 100 : 0;
  const pctDest = entoradas > 0 ? (dest.length / entoradas) * 100 : 0;
  const pesoPromDest = dest.filter(d => d.peso_destete).length > 0
    ? dest.filter(d => d.peso_destete).reduce((s, d) => s + Number(d.peso_destete), 0) / dest.filter(d => d.peso_destete).length
    : null;

  const html = `
    <h1>${estNombre}</h1>
    <div class="meta">Informe Reproductivo — Últimos 12 meses — ${new Date().toLocaleDateString("es-AR")}</div>
    <div class="kpis">
      <div class="kpi"><div class="kpi-val">${fmtPct(pctPrenez)}</div><div class="kpi-lbl">% Preñez</div></div>
      <div class="kpi"><div class="kpi-val">${fmtPct(pctPar)}</div><div class="kpi-lbl">% Parición</div></div>
      <div class="kpi"><div class="kpi-val">${fmtPct(pctDest)}</div><div class="kpi-lbl">% Destete</div></div>
      <div class="kpi"><div class="kpi-val">${pesoPromDest ? fmtNum(pesoPromDest, 1) + " kg" : "—"}</div><div class="kpi-lbl">Peso prom. destete</div></div>
    </div>
    <h2>Resumen numérico</h2>
    <table>
      <thead><tr><th>Evento</th><th style="text-align:right">Cantidad</th><th>Sobre</th></tr></thead>
      <tbody>
        <tr><td>Servicios / entores</td><td style="text-align:right">${srv.length}</td><td>${entoradas} vacas</td></tr>
        <tr><td>Tactos realizados</td><td style="text-align:right">${tacTotales}</td><td></td></tr>
        <tr><td>Diagnósticos positivos (preñadas)</td><td style="text-align:right">${prenadas}</td><td>${fmtPct(pctPrenez)} de entores</td></tr>
        <tr><td>Pariciones vivas</td><td style="text-align:right">${parVivas}</td><td>${fmtPct(pctPar)} de entores</td></tr>
        <tr><td>Destetes</td><td style="text-align:right">${dest.length}</td><td>${fmtPct(pctDest)} de entores</td></tr>
        <tr><td>Abortos</td><td style="text-align:right">${(abortos ?? []).length}</td><td></td></tr>
      </tbody>
    </table>
    <h2>Tactos (${tac.length})</h2>
    <table>
      <thead><tr><th>Fecha</th><th>Vaca</th><th>Resultado</th><th>Edad fetal</th></tr></thead>
      <tbody>${tac.map(t => `
        <tr>
          <td>${fmtDate(t.fecha)}</td>
          <td style="font-family:monospace">${(t.animales as any)?.caravana ?? "?"}</td>
          <td><span class="badge ${t.resultado ? "badge-ok" : "badge-err"}">${t.resultado ? "Preñada" : "Vacía"}</span></td>
          <td>${t.edad_fetal_dias ? t.edad_fetal_dias + " días" : "—"}</td>
        </tr>`).join("")}
      </tbody>
    </table>
    <h2>Pariciones (${par.length})</h2>
    <table>
      <thead><tr><th>Fecha</th><th>Vaca</th><th>Sexo cría</th><th>Vivo</th><th style="text-align:right">Peso nac.</th></tr></thead>
      <tbody>${par.map(p => `
        <tr>
          <td>${fmtDate(p.fecha)}</td>
          <td style="font-family:monospace">${(p.animales as any)?.caravana ?? "?"}</td>
          <td>${p.sexo_cria === "macho" ? "♂ Macho" : "♀ Hembra"}</td>
          <td><span class="badge ${p.vivo ? "badge-ok" : "badge-err"}">${p.vivo ? "Vivo" : "Muerto"}</span></td>
          <td style="text-align:right">${p.peso_nacimiento ? fmtNum(p.peso_nacimiento, 1) + " kg" : "—"}</td>
        </tr>`).join("")}
      </tbody>
    </table>`;

  abrirPDF(`Reproducción ${estNombre}`, html);
}

// ─── 3. Informe de Sanidad ────────────────────────────────────────────────────

export async function generarInformeSanidad(estId: string, estNombre: string) {
  const since = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("sanidad")
    .select("id, tipo, producto, fecha, dosis, unidad, costo, veterinario, animales(caravana)")
    .eq("establecimiento_id", estId).gte("fecha", since).order("fecha", { ascending: false });

  const items = (data ?? []) as any[];

  // Agrupar por producto
  const porProducto: Record<string, { tipo: string; aplicaciones: number; costoTotal: number }> = {};
  for (const s of items) {
    const key = `${s.producto} (${s.tipo})`;
    if (!porProducto[key]) porProducto[key] = { tipo: s.tipo, aplicaciones: 0, costoTotal: 0 };
    porProducto[key].aplicaciones++;
    if (s.costo) porProducto[key].costoTotal += Number(s.costo);
  }
  const costoTotal = items.reduce((s, i) => s + Number(i.costo ?? 0), 0);

  const html = `
    <h1>${estNombre}</h1>
    <div class="meta">Informe de Sanidad — Últimos 12 meses — ${new Date().toLocaleDateString("es-AR")}</div>
    <div class="kpis">
      <div class="kpi"><div class="kpi-val">${items.length}</div><div class="kpi-lbl">Eventos registrados</div></div>
      <div class="kpi"><div class="kpi-val">${Object.keys(porProducto).length}</div><div class="kpi-lbl">Productos distintos</div></div>
      <div class="kpi"><div class="kpi-val">$ ${fmtNum(costoTotal, 0)}</div><div class="kpi-lbl">Costo total</div></div>
      <div class="kpi"><div class="kpi-val">${new Set(items.map(i => i.animales?.caravana)).size}</div><div class="kpi-lbl">Animales tratados</div></div>
    </div>
    <h2>Resumen por producto</h2>
    <table>
      <thead><tr><th>Producto</th><th>Tipo</th><th style="text-align:right">Aplicaciones</th><th style="text-align:right">Costo total</th></tr></thead>
      <tbody>
        ${Object.entries(porProducto).sort(([,a],[,b]) => b.aplicaciones - a.aplicaciones).map(([prod, d]) => `
          <tr>
            <td>${prod}</td>
            <td>${d.tipo}</td>
            <td style="text-align:right">${d.aplicaciones}</td>
            <td style="text-align:right">${d.costoTotal > 0 ? "$ " + fmtNum(d.costoTotal, 0) : "—"}</td>
          </tr>`).join("")}
      </tbody>
    </table>
    <h2>Historial completo (${items.length})</h2>
    <table>
      <thead><tr><th>Fecha</th><th>Animal</th><th>Tipo</th><th>Producto</th><th>Dosis</th><th>Veterinario</th><th style="text-align:right">Costo</th></tr></thead>
      <tbody>
        ${items.map(s => `
          <tr>
            <td>${fmtDate(s.fecha)}</td>
            <td style="font-family:monospace">${s.animales?.caravana ?? "—"}</td>
            <td>${s.tipo}</td>
            <td><strong>${s.producto}</strong></td>
            <td>${s.dosis ? fmtNum(s.dosis, 1) + (s.unidad ? " " + s.unidad : "") : "—"}</td>
            <td>${s.veterinario ?? "—"}</td>
            <td style="text-align:right">${s.costo ? "$ " + fmtNum(s.costo, 0) : "—"}</td>
          </tr>`).join("")}
      </tbody>
    </table>`;

  abrirPDF(`Sanidad ${estNombre}`, html);
}
