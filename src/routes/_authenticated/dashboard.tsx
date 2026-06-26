import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEstablecimiento } from "@/hooks/use-establecimiento";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtNum, fmtPct } from "@/lib/format";
import { generarInformeRodeo, generarInformeReproductivo, generarInformeSanidad } from "@/lib/pdf-reports";
import { FileDown } from "lucide-react";
import {
  Beef, HeartPulse, Baby, Scale, Sprout, AlertTriangle,
  TrendingUp, Activity, DollarSign, Wallet, MapPinned, CheckCircle2, Bell,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Ganadero IA" }] }),
  component: Dashboard,
});

type Stats = {
  stock: number; vacas: number; toros: number; vaquillonas: number; terneros: number;
  evTotales: number; preniezPct: number; destetePct: number; cargaAnimal: number;
  paricionesAnio: number; superficie: number; gdp: number | null;
  mortalidadPct: number; kgCarneHa: number; ingresos: number; egresos: number; margenBruto: number;
};

type StockPotrero = { potrero: string; total: number; ha: number; cats: { nombre: string; total: number }[] };

type Alerta = { id: string; tipo: string; prioridad: string; mensaje: string; created_at: string };

async function loadStats(eid: string): Promise<Stats> {
  const since = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const [
    { data: animales }, { data: cats }, { data: est }, { data: servicios },
    { data: diags }, { data: destetes }, { data: pariciones }, { data: muertes },
    { data: ventasKg }, { data: pesadas }, { data: finanzas },
  ] = await Promise.all([
    supabase.from("animales").select("id, sexo, categoria_id, estado, estado_reproductivo").eq("establecimiento_id", eid).eq("estado", "activo"),
    supabase.from("categorias").select("id, nombre, ev"),
    supabase.from("establecimientos").select("superficie_ganadera").eq("id", eid).single(),
    supabase.from("servicios").select("id, vaca_id").eq("establecimiento_id", eid).gte("fecha", since),
    supabase.from("diagnosticos").select("id, vaca_id, resultado").eq("establecimiento_id", eid).gte("fecha", since),
    supabase.from("destetes").select("id, peso_destete").eq("establecimiento_id", eid).gte("fecha", since),
    supabase.from("pariciones").select("id, vivo").eq("establecimiento_id", eid).gte("fecha", since),
    supabase.from("movimientos").select("id").eq("establecimiento_id", eid).eq("tipo", "muerte").gte("fecha", since),
    supabase.from("animales").select("peso_actual").eq("establecimiento_id", eid).eq("estado", "vendido").gte("updated_at", since),
    supabase.from("pesadas").select("animal_id, peso, fecha").eq("establecimiento_id", eid).gte("fecha", since).order("fecha", { ascending: true }),
    supabase.from("finanzas_movimientos").select("tipo, monto").eq("establecimiento_id", eid).gte("fecha", since),
  ]);
  const catMap = new Map((cats ?? []).map((c) => [c.id, c]));
  const a = animales ?? [];
  const byCat = (n: string) => a.filter((x) => catMap.get(x.categoria_id ?? "")?.nombre === n).length;
  const stock = a.length;
  const evTotales = a.reduce((acc, an) => acc + Number(catMap.get(an.categoria_id ?? "")?.ev ?? 0), 0);
  const superficie = Number(est?.superficie_ganadera ?? 0);
  const entoradas = new Set((servicios ?? []).map((s) => s.vaca_id)).size;
  const prenadas = new Set((diags ?? []).filter((d) => d.resultado).map((d) => d.vaca_id)).size;
  const porAnimal = new Map<string, { first: any; last: any }>();
  for (const p of pesadas ?? []) {
    const cur = porAnimal.get(p.animal_id);
    if (!cur) porAnimal.set(p.animal_id, { first: p, last: p }); else cur.last = p;
  }
  let gdpSum = 0, gdpCount = 0;
  for (const { first, last } of porAnimal.values()) {
    if (first === last) continue;
    const days = (new Date(last.fecha).getTime() - new Date(first.fecha).getTime()) / 86400000;
    if (days < 30) continue;
    const diff = Number(last.peso) - Number(first.peso);
    if (diff <= 0) continue;
    gdpSum += diff / days; gdpCount++;
  }
  const muertesCount = muertes?.length ?? 0;
  const kgVendidos = (ventasKg ?? []).reduce((s, a) => s + Number(a.peso_actual ?? 0), 0);
  const ingresos = (finanzas ?? []).filter((f) => f.tipo === "ingreso").reduce((s, f) => s + Number(f.monto), 0);
  const egresos = (finanzas ?? []).filter((f) => f.tipo === "egreso").reduce((s, f) => s + Number(f.monto), 0);
  return {
    stock, vacas: byCat("Vaca"), toros: byCat("Toro"), vaquillonas: byCat("Vaquillona"),
    terneros: byCat("Ternero") + byCat("Ternera"), evTotales,
    preniezPct: entoradas > 0 ? (prenadas / entoradas) * 100 : 0,
    destetePct: entoradas > 0 ? ((destetes?.length ?? 0) / entoradas) * 100 : 0,
    cargaAnimal: superficie > 0 ? evTotales / superficie : 0,
    paricionesAnio: (pariciones ?? []).filter((p) => p.vivo).length,
    superficie, gdp: gdpCount > 0 ? gdpSum / gdpCount : null,
    mortalidadPct: stock + muertesCount > 0 ? (muertesCount / (stock + muertesCount)) * 100 : 0,
    kgCarneHa: superficie > 0 ? kgVendidos / superficie : 0,
    ingresos, egresos, margenBruto: ingresos - egresos,
  };
}

function KpiCard({ icon: Icon, label, value, sub, accent, danger }: {
  icon: any; label: string; value: string; sub?: string; accent?: boolean; danger?: boolean;
}) {
  const base = danger ? "border-destructive/40 bg-destructive/5" : accent ? "bg-primary text-primary-foreground border-primary" : "";
  return (
    <Card className={`p-5 ${base}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className={`text-xs uppercase tracking-wider ${accent ? "text-primary-foreground/80" : danger ? "text-destructive" : "text-muted-foreground"}`}>{label}</div>
          <div className={`text-3xl font-semibold mt-2 tabular-nums ${danger ? "text-destructive" : ""}`}>{value}</div>
          {sub && <div className={`text-xs mt-1 ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{sub}</div>}
        </div>
        <Icon className={`h-5 w-5 ${accent ? "text-primary-foreground/80" : danger ? "text-destructive" : "text-muted-foreground"}`} />
      </div>
    </Card>
  );
}

function Dashboard() {
  const { active, activeId, loading: loadingEst } = useActiveEstablecimiento();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [stockPotrero, setStockPotrero] = useState<StockPotrero[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);

  useEffect(() => {
    if (!activeId) return;
    setLoading(true);
    loadStats(activeId).then((s) => { setStats(s); setLoading(false); });

    // Stock por potrero
    Promise.all([
      supabase.from("animales").select("potrero_id, categoria:categorias(nombre)").eq("establecimiento_id", activeId).eq("estado", "activo").not("potrero_id", "is", null),
      supabase.from("potreros").select("id, nombre, hectareas").eq("establecimiento_id", activeId),
    ]).then(([{ data: aps }, { data: pots }]) => {
      const potMap = new Map((pots ?? []).map((p) => [p.id, p]));
      const byPot: Record<string, Record<string, number>> = {};
      for (const a of (aps as any[]) ?? []) {
        const pid = a.potrero_id;
        const cat = a.categoria?.nombre ?? "Sin categoría";
        if (!byPot[pid]) byPot[pid] = {};
        byPot[pid][cat] = (byPot[pid][cat] ?? 0) + 1;
      }
      const result: StockPotrero[] = Object.entries(byPot).map(([pid, cats]) => ({
        potrero: potMap.get(pid)?.nombre ?? pid,
        ha: Number(potMap.get(pid)?.hectareas ?? 0),
        total: Object.values(cats).reduce((s, n) => s + n, 0),
        cats: Object.entries(cats).map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total),
      })).sort((a, b) => b.total - a.total);
      setStockPotrero(result);
    });

    // Alertas IA pendientes
    supabase.from("ia_alertas").select("id, tipo, prioridad, mensaje, created_at")
      .eq("establecimiento_id", activeId).eq("resuelta", false)
      .order("created_at", { ascending: false }).limit(10)
      .then(({ data }) => setAlertas((data as Alerta[]) ?? []));
  }, [activeId]);

  async function resolverAlerta(id: string) {
    await supabase.from("ia_alertas").update({ resuelta: true }).eq("id", id);
    setAlertas((prev) => prev.filter((a) => a.id !== id));
  }

  if (loadingEst) return <div className="p-8">Cargando…</div>;

  if (!active) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Card className="p-8 text-center">
          <Sprout className="h-12 w-12 mx-auto text-primary" />
          <h2 className="text-2xl font-semibold mt-4">Empezá creando tu campo</h2>
          <p className="text-muted-foreground mt-2">Para usar el sistema necesitás al menos un establecimiento.</p>
          <Button asChild size="lg" className="mt-6"><Link to="/establecimientos">Crear establecimiento</Link></Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{active.nombre}</h1>
          <p className="text-muted-foreground text-sm">Dashboard ejecutivo · {fmtNum(active.superficie_ganadera ?? 0)} ha ganaderas</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/animales">Ver rodeo</Link></Button>
          <Button asChild><Link to="/manga">Modo manga</Link></Button>
          <div className="relative group">
            <Button variant="outline" className="flex items-center gap-2">
              <FileDown className="h-4 w-4" />Informes PDF
            </Button>
            <div className="absolute right-0 top-full mt-1 w-52 bg-background border rounded-lg shadow-lg z-10 hidden group-hover:block">
              <button
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted rounded-t-lg"
                onClick={() => generarInformeRodeo(active.id, active.nombre)}
              >📋 Rodeo completo</button>
              <button
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted"
                onClick={() => generarInformeReproductivo(active.id, active.nombre)}
              >🐄 Reproducción 12m</button>
              <button
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted rounded-b-lg"
                onClick={() => generarInformeSanidad(active.id, active.nombre)}
              >💉 Sanidad 12m</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Alertas IA pendientes ── */}
      {alertas.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-4 w-4 text-amber-600" />
            <span className="font-semibold text-amber-800 dark:text-amber-300">
              {alertas.length} alerta{alertas.length > 1 ? "s" : ""} pendiente{alertas.length > 1 ? "s" : ""} de la IA
            </span>
          </div>
          <div className="space-y-2">
            {alertas.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="flex items-start gap-2 flex-1">
                  <Badge
                    variant={a.prioridad === "alta" ? "destructive" : a.prioridad === "media" ? "default" : "secondary"}
                    className="text-[10px] mt-0.5 shrink-0"
                  >
                    {a.prioridad}
                  </Badge>
                  <span className="text-amber-900 dark:text-amber-200">{a.mensaje}</span>
                </div>
                <Button
                  size="sm" variant="ghost"
                  className="h-7 px-2 text-xs text-amber-700 hover:text-emerald-700 shrink-0"
                  onClick={() => resolverAlerta(a.id)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Resolver
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {loading || !stats ? (
        <div className="grid md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={Beef} label="Stock total" value={fmtNum(stats.stock)} sub="animales activos" accent />
            <KpiCard icon={Activity} label="EV totales" value={fmtNum(stats.evTotales, 1)} sub={`${fmtNum(stats.cargaAnimal, 2)} EV/ha`} />
            <KpiCard icon={HeartPulse} label="% Preñez" value={fmtPct(stats.preniezPct)} sub="últ. 12 meses" />
            <KpiCard icon={Baby} label="% Destete" value={fmtPct(stats.destetePct)} sub="últ. 12 meses" />
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={Beef} label="Vacas" value={fmtNum(stats.vacas)} />
            <KpiCard icon={Beef} label="Vaquillonas" value={fmtNum(stats.vaquillonas)} />
            <KpiCard icon={Beef} label="Terneros/as" value={fmtNum(stats.terneros)} />
            <KpiCard icon={Beef} label="Toros" value={fmtNum(stats.toros)} />
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <KpiCard icon={TrendingUp} label="Pariciones (12m)" value={fmtNum(stats.paricionesAnio)} sub="terneros vivos" />
            <KpiCard icon={Scale} label="Carga animal" value={`${fmtNum(stats.cargaAnimal, 2)} EV/ha`} sub={`Sobre ${fmtNum(stats.superficie)} ha`} />
            <KpiCard icon={AlertTriangle} label="Mortalidad" value={fmtPct(stats.mortalidadPct)} sub="últ. 12 meses" danger={stats.mortalidadPct > 3} />
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={TrendingUp} label="GDP promedio" value={stats.gdp != null ? `${fmtNum(stats.gdp * 1000, 0)} g/día` : "—"} sub="ganancia diaria de peso" />
            <KpiCard icon={Scale} label="Kg carne / ha" value={fmtNum(stats.kgCarneHa, 1)} sub="vendidos últ. 12m" />
            <KpiCard icon={DollarSign} label="Ingresos 12m" value={`$ ${fmtNum(stats.ingresos, 0)}`} />
            <KpiCard icon={Wallet} label="Margen bruto" value={`$ ${fmtNum(stats.margenBruto, 0)}`} sub={`Egresos: $ ${fmtNum(stats.egresos, 0)}`} danger={stats.margenBruto < 0} />
          </div>

          {/* ── Stock por potrero ── */}
          {stockPotrero.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold flex items-center gap-2">
                  <MapPinned className="h-4 w-4 text-muted-foreground" />Stock por potrero
                </h2>
                <Button asChild variant="ghost" size="sm" className="text-xs"><Link to="/potreros">Ver detalle →</Link></Button>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {stockPotrero.map((sp) => (
                  <Card key={sp.potrero} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{sp.potrero}</span>
                      <div className="text-right">
                        <span className="text-2xl font-bold tabular-nums">{sp.total}</span>
                        {sp.ha > 0 && <div className="text-xs text-muted-foreground">{fmtNum(sp.total / sp.ha, 2)} an/ha</div>}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {sp.cats.map((c) => (
                        <div key={c.nombre} className="flex justify-between text-xs text-muted-foreground">
                          <span>{c.nombre}</span>
                          <span className="tabular-nums font-medium">{c.total}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <Card className="p-6">
            <h2 className="font-semibold mb-3">Acciones rápidas</h2>
            <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-2">
              {[
                { to: "/animales", label: "Alta animal" },
                { to: "/reproduccion", label: "Servicio" },
                { to: "/reproduccion", label: "Tacto" },
                { to: "/sanidad", label: "Vacuna" },
                { to: "/pesadas", label: "Pesada" },
                { to: "/ia", label: "Preguntar a IA" },
              ].map((a) => (
                <Button asChild key={a.label} variant="outline" className="h-14"><Link to={a.to}>{a.label}</Link></Button>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
