import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEstablecimiento } from "@/hooks/use-establecimiento";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmtNum, fmtPct } from "@/lib/format";
import {
  Beef,
  HeartPulse,
  Baby,
  Scale,
  Sprout,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Ganadero IA" }] }),
  component: Dashboard,
});

type Stats = {
  stock: number;
  vacas: number;
  toros: number;
  vaquillonas: number;
  terneros: number;
  evTotales: number;
  preniezPct: number;
  destetePct: number;
  cargaAnimal: number;
  paricionesAnio: number;
  superficie: number;
  gdp: number | null;
  mortalidadPct: number;
  kgCarneHa: number;
  ingresos: number;
  egresos: number;
  margenBruto: number;
};

async function loadStats(establecimientoId: string): Promise<Stats> {
  const since12m = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const [
    { data: animales },
    { data: cats },
    { data: est },
    { data: servicios },
    { data: diags },
    { data: destetes },
    { data: pariciones },
    { data: muertes },
    { data: ventasKg },
    { data: pesadas },
    { data: finanzas },
  ] = await Promise.all([
    supabase.from("animales").select("id, sexo, categoria_id, estado, estado_reproductivo").eq("establecimiento_id", establecimientoId).eq("estado", "activo"),
    supabase.from("categorias").select("id, nombre, ev"),
    supabase.from("establecimientos").select("superficie_ganadera").eq("id", establecimientoId).single(),
    supabase.from("servicios").select("id, vaca_id").eq("establecimiento_id", establecimientoId).gte("fecha", since12m),
    supabase.from("diagnosticos").select("id, vaca_id, resultado").eq("establecimiento_id", establecimientoId).gte("fecha", since12m),
    supabase.from("destetes").select("id, peso_destete").eq("establecimiento_id", establecimientoId).gte("fecha", since12m),
    supabase.from("pariciones").select("id, vivo").eq("establecimiento_id", establecimientoId).gte("fecha", since12m),
    supabase.from("movimientos").select("id").eq("establecimiento_id", establecimientoId).eq("tipo", "muerte").gte("fecha", since12m),
    supabase.from("animales").select("peso_actual").eq("establecimiento_id", establecimientoId).eq("estado", "vendido").gte("updated_at", since12m),
    supabase.from("pesadas").select("animal_id, peso, fecha").eq("establecimiento_id", establecimientoId).gte("fecha", since12m).order("fecha", { ascending: true }),
    supabase.from("finanzas_movimientos").select("tipo, monto").eq("establecimiento_id", establecimientoId).gte("fecha", since12m),
  ]);

  const catMap = new Map((cats ?? []).map((c) => [c.id, c]));
  const a = animales ?? [];

  const byCat = (name: string) => a.filter((x) => catMap.get(x.categoria_id ?? "")?.nombre === name).length;
  const stock = a.length;
  const vacas = byCat("Vaca");
  const toros = byCat("Toro");
  const vaquillonas = byCat("Vaquillona");
  const terneros = byCat("Ternero") + byCat("Ternera");

  const evTotales = a.reduce((acc, an) => acc + Number(catMap.get(an.categoria_id ?? "")?.ev ?? 0), 0);
  const superficie = Number(est?.superficie_ganadera ?? 0);
  const cargaAnimal = superficie > 0 ? evTotales / superficie : 0;

  const entoradas = new Set((servicios ?? []).map((s) => s.vaca_id)).size;
  const prenadas = new Set((diags ?? []).filter((d) => d.resultado).map((d) => d.vaca_id)).size;
  const preniezPct = entoradas > 0 ? (prenadas / entoradas) * 100 : 0;
  const destetePct = entoradas > 0 ? ((destetes?.length ?? 0) / entoradas) * 100 : 0;
  const paricionesAnio = (pariciones ?? []).filter((p) => p.vivo).length;

  // GDP promedio: por animal, primera y última pesada del periodo
  const porAnimal = new Map<string, { first: any; last: any }>();
  for (const p of pesadas ?? []) {
    const cur = porAnimal.get(p.animal_id);
    if (!cur) porAnimal.set(p.animal_id, { first: p, last: p });
    else cur.last = p;
  }
  let gdpSum = 0, gdpCount = 0;
  for (const { first, last } of porAnimal.values()) {
    if (first === last) continue;
    const days = (new Date(last.fecha).getTime() - new Date(first.fecha).getTime()) / 86400000;
    if (days < 30) continue;
    const diff = Number(last.peso) - Number(first.peso);
    if (diff <= 0) continue;
    gdpSum += diff / days;
    gdpCount++;
  }
  const gdp = gdpCount > 0 ? gdpSum / gdpCount : null;

  const muertesCount = muertes?.length ?? 0;
  const mortalidadPct = stock + muertesCount > 0 ? (muertesCount / (stock + muertesCount)) * 100 : 0;

  const kgVendidos = (ventasKg ?? []).reduce((s, a) => s + Number(a.peso_actual ?? 0), 0);
  const kgCarneHa = superficie > 0 ? kgVendidos / superficie : 0;

  const ingresos = (finanzas ?? []).filter((f) => f.tipo === "ingreso").reduce((s, f) => s + Number(f.monto), 0);
  const egresos = (finanzas ?? []).filter((f) => f.tipo === "egreso").reduce((s, f) => s + Number(f.monto), 0);
  const margenBruto = ingresos - egresos;

  return { stock, vacas, toros, vaquillonas, terneros, evTotales, preniezPct, destetePct, cargaAnimal, paricionesAnio, superficie, gdp, mortalidadPct, kgCarneHa, ingresos, egresos, margenBruto };
}

function KpiCard({ icon: Icon, label, value, sub, accent }: { icon: any; label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <Card className={`p-5 ${accent ? "bg-primary text-primary-foreground border-primary" : ""}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className={`text-xs uppercase tracking-wider ${accent ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{label}</div>
          <div className="text-3xl font-semibold mt-2 tabular-nums">{value}</div>
          {sub && <div className={`text-xs mt-1 ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{sub}</div>}
        </div>
        <Icon className={`h-5 w-5 ${accent ? "text-primary-foreground/80" : "text-muted-foreground"}`} />
      </div>
    </Card>
  );
}

function Dashboard() {
  const { active, activeId, loading: loadingEst } = useActiveEstablecimiento();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeId) return;
    setLoading(true);
    loadStats(activeId).then((s) => {
      setStats(s);
      setLoading(false);
    });
  }, [activeId]);

  if (loadingEst) return <div className="p-8">Cargando…</div>;

  if (!active) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Card className="p-8 text-center">
          <Sprout className="h-12 w-12 mx-auto text-primary" />
          <h2 className="text-2xl font-semibold mt-4">Empezá creando tu campo</h2>
          <p className="text-muted-foreground mt-2">
            Para usar el sistema necesitás al menos un establecimiento. Cargá el primero en menos de un minuto.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link to="/establecimientos">Crear establecimiento</Link>
          </Button>
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
        </div>
      </div>

      {loading || !stats ? (
        <div className="grid md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
          ))}
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
            <KpiCard icon={AlertTriangle} label="Mortalidad" value={fmtPct(stats.mortalidadPct)} sub="últ. 12 meses" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={TrendingUp} label="GDP promedio" value={stats.gdp != null ? `${fmtNum(stats.gdp * 1000, 0)} g/día` : "—"} sub="ganancia diaria de peso" />
            <KpiCard icon={Scale} label="Kg carne / ha" value={fmtNum(stats.kgCarneHa, 1)} sub="vendidos últ. 12m" />
            <KpiCard icon={DollarSign} label="Ingresos 12m" value={`$ ${fmtNum(stats.ingresos, 0)}`} />
            <KpiCard icon={Wallet} label="Margen bruto" value={`$ ${fmtNum(stats.margenBruto, 0)}`} sub={`Egresos: $ ${fmtNum(stats.egresos, 0)}`} />
          </div>

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
                <Button asChild key={a.label} variant="outline" className="h-14">
                  <Link to={a.to}>{a.label}</Link>
                </Button>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}