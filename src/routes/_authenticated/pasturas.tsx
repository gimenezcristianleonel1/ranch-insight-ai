import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEstablecimiento } from "@/hooks/use-establecimiento";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Plus, Sprout, TrendingUp, TrendingDown, Minus, Pencil, Scale, AlertTriangle } from "lucide-react";
import { fmtNum, fmtDate } from "@/lib/format";
import { ExportMenu } from "@/components/data-io";
import { ConfirmDelete } from "@/components/confirm";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";

export const Route = createFileRoute("/_authenticated/pasturas")({
  head: () => ({ meta: [{ title: "Pasturas y Balance Forrajero — Ganadero IA" }] }),
  component: PasturasPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type Aforo = {
  id: string; potrero_id: string | null; fecha: string;
  kg_ms_ha: number; altura_cm: number | null; metodo: string | null; observaciones: string | null;
  potrero?: { nombre: string; hectareas: number } | null;
};

type Potrero = { id: string; nombre: string; hectareas: number };

type StockPotrero = {
  potrero_id: string; potrero_nombre: string; hectareas: number;
  ev_totales: number; ev_por_ha: number; req_ms_dia: number;
};

type BalancePotrero = {
  potrero_id: string; nombre: string; hectareas: number;
  ev_totales: number; ev_por_ha: number; req_ms_dia: number;
  kg_ms_ha_disponible: number | null; kg_ms_total: number | null;
  autonomia_dias: number | null;
  balance: "superavit" | "ajustado" | "deficit" | "sin_datos";
};

const METODOS = ["visual", "regla", "plato", "corte"];
const NIVEL_COLORES = { alto: "text-emerald-600 dark:text-emerald-400", medio: "text-amber-600 dark:text-amber-400", bajo: "text-destructive" };

const emptyForm = { potrero_id: "", fecha: new Date().toISOString().slice(0, 10), kg_ms_ha: "", altura_cm: "", metodo: "visual", observaciones: "" };

function PasturasPage() {
  const { activeId, active } = useActiveEstablecimiento();
  if (!active) return <div className="p-8 text-muted-foreground">Seleccioná un establecimiento.</div>;
  return <PasturasInner estId={activeId!} estNombre={active.nombre} />;
}

function PasturasInner({ estId, estNombre }: { estId: string; estNombre: string }) {
  const [aforos, setAforos] = useState<Aforo[]>([]);
  const [potreros, setPotreros] = useState<Potrero[]>([]);
  const [stockPotreros, setStockPotreros] = useState<StockPotrero[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filtroPotrero, setFiltroPotrero] = useState("todos");

  async function generarAlertasForrajeras(balancesActuales: typeof balances) {
    // Generar alertas en ia_alertas para potreros con déficit
    const deficit = balancesActuales.filter(b => b.balance === "deficit" || b.balance === "ajustado");
    if (!deficit.length) return;

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    for (const b of deficit) {
      const prioridad = b.balance === "deficit" ? "alta" : "media";
      const msg = b.balance === "deficit"
        ? `Déficit forrajero crítico en ${b.nombre}: ${b.autonomia_dias} días de autonomía. Requerimiento: ${Math.round(b.req_ms_dia)} kg MS/día.`
        : `Pastura ajustada en ${b.nombre}: ${b.autonomia_dias} días de autonomía. Considerar rotación pronto.`;

      // Verificar si ya existe una alerta no resuelta para este potrero
      const { data: existente } = await supabase.from("ia_alertas")
        .select("id").eq("establecimiento_id", estId)
        .eq("resuelta", false).ilike("mensaje", `%${b.nombre}%`)
        .maybeSingle();

      if (!existente) {
        await supabase.from("ia_alertas").insert({
          establecimiento_id: estId,
          tipo: "balance_forrajero",
          prioridad,
          mensaje: msg,
          resuelta: false,
        });
      }
    }
  }

  async function load() {
    const { data } = await supabase
      .from("aforos").select("*, potrero:potreros(nombre, hectareas)")
      .eq("establecimiento_id", estId).order("fecha", { ascending: false }).limit(500);
    setAforos((data as Aforo[]) ?? []);
  }

  useEffect(() => {
    load();
    supabase.from("potreros").select("id, nombre, hectareas").eq("establecimiento_id", estId).order("nombre")
      .then(({ data }) => setPotreros(data ?? []));

    // Cargar EV y requerimientos por potrero desde la vista
    // (consulta directa sin RPC)
    supabase.from("animales")
      .select("potrero_id, categoria:categorias(nombre, ev, requerimiento_ms)")
      .eq("establecimiento_id", estId).eq("estado", "activo").not("potrero_id", "is", null)
      .then(({ data: anim }) => {
        if (!anim) return;
        const byPot: Record<string, { ev: number; req: number; count: number }> = {};
        for (const a of anim as any[]) {
          const pid = a.potrero_id;
          if (!byPot[pid]) byPot[pid] = { ev: 0, req: 0, count: 0 };
          byPot[pid].ev += a.categoria?.ev ?? 1;
          byPot[pid].req += a.categoria?.requerimiento_ms ?? 10;
          byPot[pid].count++;
        }
        supabase.from("potreros").select("id, nombre, hectareas").eq("establecimiento_id", estId)
          .then(({ data: pots }) => {
            if (!pots) return;
            const stock: StockPotrero[] = pots.map((p: any) => {
              const d = byPot[p.id] ?? { ev: 0, req: 0, count: 0 };
              return {
                potrero_id: p.id, potrero_nombre: p.nombre, hectareas: Number(p.hectareas),
                ev_totales: d.ev,
                ev_por_ha: p.hectareas > 0 ? d.ev / Number(p.hectareas) : 0,
                req_ms_dia: d.req,
              };
            });
            setStockPotreros(stock);
          });
      });
  }, [estId]);

  // ── Generar alertas cuando cambia el balance ──
  // (se llama después de calcular balances en el useMemo de abajo)

  // ── Balance forrajero ──
  const balances = useMemo<BalancePotrero[]>(() => {
    const ultimoPorPotrero = new Map<string, number>();
    for (const a of aforos) {
      if (a.potrero_id && !ultimoPorPotrero.has(a.potrero_id)) {
        ultimoPorPotrero.set(a.potrero_id, Number(a.kg_ms_ha));
      }
    }
    return stockPotreros.map((sp) => {
      const kgMsHa = ultimoPorPotrero.get(sp.potrero_id) ?? null;
      const kgMsTotal = kgMsHa !== null && sp.hectareas > 0 ? kgMsHa * sp.hectareas : null;
      const autonomia = kgMsTotal !== null && sp.req_ms_dia > 0 ? Math.floor(kgMsTotal / sp.req_ms_dia) : null;
      let balance: BalancePotrero["balance"] = "sin_datos";
      if (autonomia !== null) {
        if (autonomia >= 45) balance = "superavit";
        else if (autonomia >= 15) balance = "ajustado";
        else balance = "deficit";
      }
      return {
        potrero_id: sp.potrero_id, nombre: sp.potrero_nombre, hectareas: sp.hectareas,
        ev_totales: sp.ev_totales, ev_por_ha: sp.ev_por_ha, req_ms_dia: sp.req_ms_dia,
        kg_ms_ha_disponible: kgMsHa, kg_ms_total: kgMsTotal,
        autonomia_dias: autonomia, balance,
      };
    });
  }, [stockPotreros, aforos]);

  // Disparar alertas cada vez que los balances se recalculan
  // (useEffect no puede depender de useMemo directamente, usamos JSON)
  const balancesJSON = JSON.stringify(balances.map(b => ({ id: b.potrero_id, balance: b.balance })));
  useState(() => {
    if (balances.some(b => b.balance === "deficit" || b.balance === "ajustado")) {
      generarAlertasForrajeras(balances);
    }
  });

  const totalEV = stockPotreros.reduce((s, p) => s + p.ev_totales, 0);
  const totalHa = potreros.reduce((s, p) => s + Number(p.hectareas), 0);
  const totalReq = stockPotreros.reduce((s, p) => s + p.req_ms_dia, 0);
  const deficit = balances.filter(b => b.balance === "deficit").length;

  // ── CRUD ──
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.kg_ms_ha) return toast.error("Ingresá el valor de kg MS/ha");
    setSaving(true);
    const { data: user } = await supabase.auth.getUser();
    const payload = {
      establecimiento_id: estId,
      potrero_id: form.potrero_id || null,
      fecha: form.fecha,
      kg_ms_ha: Number(form.kg_ms_ha),
      altura_cm: form.altura_cm ? Number(form.altura_cm) : null,
      metodo: form.metodo || null,
      observaciones: form.observaciones || null,
      user_id: user.user?.id ?? null,
    };
    const { error } = editing
      ? await supabase.from("aforos").update(payload).eq("id", editing)
      : await supabase.from("aforos").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Aforo actualizado" : "Aforo registrado");
    setOpen(false); setEditing(null); setForm(emptyForm); load();
  }

  async function handleDelete(id: string) {
    await supabase.from("aforos").delete().eq("id", id);
    toast.success("Aforo eliminado"); load();
  }

  function openEdit(a: Aforo) {
    setEditing(a.id);
    setForm({ potrero_id: a.potrero_id ?? "", fecha: a.fecha, kg_ms_ha: String(a.kg_ms_ha), altura_cm: a.altura_cm ? String(a.altura_cm) : "", metodo: a.metodo ?? "visual", observaciones: a.observaciones ?? "" });
    setOpen(true);
  }

  const filtered = filtroPotrero === "todos" ? aforos : aforos.filter(a => a.potrero_id === filtroPotrero);

  // Datos gráfico
  const chartData = useMemo(() => {
    const byDate: Record<string, Record<string, number>> = {};
    for (const a of [...aforos].reverse()) {
      const date = a.fecha.slice(0, 10);
      if (!byDate[date]) byDate[date] = {};
      const key = a.potrero?.nombre ?? "General";
      byDate[date][key] = Number(a.kg_ms_ha);
    }
    return Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date: fmtDate(date), ...vals })).slice(-60);
  }, [aforos]);

  const potreroNombres = [...new Set(aforos.map(a => a.potrero?.nombre ?? "General"))];
  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

  const exportCols = [
    { key: "fecha", header: "fecha" },
    { key: "potrero", header: "potrero", get: (a: Aforo) => a.potrero?.nombre ?? "" },
    { key: "kg_ms_ha", header: "kg_ms_ha" },
    { key: "altura_cm", header: "altura_cm" },
    { key: "metodo", header: "metodo" },
    { key: "observaciones", header: "observaciones" },
  ];

  const balanceColor = (b: string) =>
    b === "superavit" ? "text-emerald-600 dark:text-emerald-400" : b === "ajustado" ? "text-amber-600" : b === "deficit" ? "text-destructive" : "text-muted-foreground";
  const balanceBadge = (b: string) =>
    b === "superavit" ? "default" : b === "ajustado" ? "secondary" : b === "deficit" ? "destructive" : "outline";

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Pasturas</h1>
          <p className="text-muted-foreground text-sm">Aforos y balance forrajero · {estNombre}</p>
        </div>
        <div className="flex gap-2">
          <ExportMenu items={filtered} cols={exportCols} filename={`aforos_${estNombre}`} />
          <Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />Nuevo aforo
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">EV totales en potreros</div><div className="text-2xl font-bold mt-1 tabular-nums">{fmtNum(totalEV, 1)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">EV/ha general</div><div className="text-2xl font-bold mt-1 tabular-nums">{fmtNum(totalHa > 0 ? totalEV / totalHa : 0, 2)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Req. MS total</div><div className="text-2xl font-bold mt-1 tabular-nums">{fmtNum(totalReq, 0)}</div><div className="text-xs text-muted-foreground">kg MS/día</div></Card>
        <Card className={`p-4 ${deficit > 0 ? "border-destructive/40 bg-destructive/5" : ""}`}>
          <div className="text-xs text-muted-foreground">Potreros con déficit</div>
          <div className={`text-2xl font-bold mt-1 ${deficit > 0 ? "text-destructive" : ""}`}>
            {deficit > 0 && <AlertTriangle className="h-5 w-5 inline mr-1" />}{deficit}
          </div>
        </Card>
      </div>

      <Tabs defaultValue="balance">
        <TabsList>
          <TabsTrigger value="balance"><Scale className="h-4 w-4 mr-1.5" />Balance forrajero</TabsTrigger>
          <TabsTrigger value="historial"><Sprout className="h-4 w-4 mr-1.5" />Aforos ({aforos.length})</TabsTrigger>
          {chartData.length > 1 && <TabsTrigger value="evolucion">Evolución</TabsTrigger>}
        </TabsList>

        {/* ══ BALANCE FORRAJERO ══ */}
        <TabsContent value="balance" className="mt-4">
          {balances.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground">
              Sin potreros con animales. Asigná animales a potreros para ver el balance.
            </Card>
          ) : (
            <div className="space-y-3">
              {balances.map((b) => {
                const pct = b.kg_ms_ha_disponible ? Math.min(100, (b.kg_ms_ha_disponible / 2000) * 100) : 0;
                return (
                  <Card key={b.potrero_id} className="p-5">
                    <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{b.nombre}</h3>
                          <Badge variant={balanceBadge(b.balance) as any} className="text-xs capitalize">
                            {b.balance === "sin_datos" ? "Sin aforo" : b.balance.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{fmtNum(b.hectareas)} ha</p>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center text-sm">
                        <div><div className="text-xs text-muted-foreground">EV totales</div><div className="font-bold tabular-nums">{fmtNum(b.ev_totales, 1)}</div></div>
                        <div><div className="text-xs text-muted-foreground">EV/ha</div><div className="font-bold tabular-nums">{fmtNum(b.ev_por_ha, 2)}</div></div>
                        <div><div className="text-xs text-muted-foreground">Req MS/día</div><div className="font-bold tabular-nums">{fmtNum(b.req_ms_dia, 0)} kg</div></div>
                      </div>
                    </div>

                    {b.kg_ms_ha_disponible !== null ? (
                      <>
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <span className="text-muted-foreground">
                            Disponible: <strong className={`${NIVEL_COLORES[b.kg_ms_ha_disponible >= 1500 ? "alto" : b.kg_ms_ha_disponible >= 800 ? "medio" : "bajo"]}`}>
                              {fmtNum(b.kg_ms_ha_disponible, 0)} kg MS/ha
                            </strong>
                          </span>
                          {b.autonomia_dias !== null && (
                            <span className={`font-semibold ${balanceColor(b.balance)}`}>
                              Autonomía: {b.autonomia_dias} días
                            </span>
                          )}
                        </div>
                        <Progress value={pct} className="h-2" />
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                          <span>0</span><span className="text-amber-500">800</span><span className="text-emerald-500">1500</span><span>2000+ kg MS/ha</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground py-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Sin aforo registrado. Ingresá el primero para ver la autonomía.
                        <Button size="sm" variant="outline" className="ml-auto h-7 text-xs"
                          onClick={() => { setForm({ ...emptyForm, potrero_id: b.potrero_id }); setOpen(true); }}>
                          + Aforar
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}

              {/* Leyenda de referencia */}
              <Card className="p-4 bg-muted/30">
                <p className="text-xs text-muted-foreground font-medium mb-2">Referencia forrajera:</p>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Superávit (≥45 días autonomía):</span><span>Pastoreo en bloques, diferir o henificar.</span>
                  <span className="text-amber-600 font-medium">Ajustado (15–44 días):</span><span>Monitorear frecuencia de pastoreo.</span>
                  <span className="text-destructive font-medium">Déficit (&lt;15 días):</span><span>Reducir carga, suplementar o diferir potreros.</span>
                </div>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ══ HISTORIAL DE AFOROS ══ */}
        <TabsContent value="historial" className="mt-4">
          <div className="flex gap-2 mb-4 flex-wrap">
            <Button size="sm" variant={filtroPotrero === "todos" ? "default" : "outline"} onClick={() => setFiltroPotrero("todos")}>Todos</Button>
            {potreros.filter(p => aforos.some(a => a.potrero_id === p.id)).map(p => (
              <Button key={p.id} size="sm" variant={filtroPotrero === p.id ? "default" : "outline"} onClick={() => setFiltroPotrero(p.id)}>{p.nombre}</Button>
            ))}
          </div>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Potrero</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Altura (cm)</TableHead>
                  <TableHead className="text-right">kg MS/ha</TableHead>
                  <TableHead>Observaciones</TableHead>
                  <TableHead className="w-20 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => {
                  const nivel = a.kg_ms_ha >= 1500 ? "alto" : a.kg_ms_ha >= 800 ? "medio" : "bajo";
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="tabular-nums">{fmtDate(a.fecha)}</TableCell>
                      <TableCell>{a.potrero?.nombre ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-muted-foreground capitalize">{a.metodo ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.altura_cm ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <span className={`font-semibold tabular-nums ${NIVEL_COLORES[nivel]}`}>{fmtNum(a.kg_ms_ha, 0)}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">{a.observaciones ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <ConfirmDelete title="¿Eliminar aforo?" description="No se puede deshacer." onConfirm={() => handleDelete(a.id)} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Sin aforos. Registrá el primero.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ══ EVOLUCIÓN ══ */}
        {chartData.length > 1 && (
          <TabsContent value="evolucion" className="mt-4">
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Evolución kg MS/ha por potrero</h3>
              <ResponsiveContainer width="100%" height={340}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary, #eee)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, "auto"]} />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine y={800} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Min", fontSize: 10, fill: "#f59e0b" }} />
                  <ReferenceLine y={1500} stroke="#10b981" strokeDasharray="4 4" label={{ value: "Óptimo", fontSize: 10, fill: "#10b981" }} />
                  {potreroNombres.map((n, i) => (
                    <Line key={n} type="monotone" dataKey={n} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Dialog CRUD */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(emptyForm); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar aforo" : "Registrar aforo"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Potrero</Label>
                <Select value={form.potrero_id || "_"} onValueChange={(v) => setForm({ ...form, potrero_id: v === "_" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="General" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">—</SelectItem>
                    {potreros.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre} ({fmtNum(p.hectareas)} ha)</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Fecha *</Label><Input type="date" required value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>kg MS/ha *</Label><Input required type="number" step="0.01" min="0" value={form.kg_ms_ha} onChange={(e) => setForm({ ...form, kg_ms_ha: e.target.value })} /></div>
              <div><Label>Altura pasto (cm)</Label><Input type="number" step="0.1" value={form.altura_cm} onChange={(e) => setForm({ ...form, altura_cm: e.target.value })} /></div>
            </div>
            <div>
              <Label>Método</Label>
              <Select value={form.metodo} onValueChange={(v) => setForm({ ...form, metodo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{METODOS.map(m => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Observaciones</Label><Textarea rows={2} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></div>
            <DialogFooter><Button type="submit" disabled={saving} className="w-full">{saving ? "Guardando…" : editing ? "Guardar" : "Registrar aforo"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
