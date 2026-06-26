import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEstablecimiento } from "@/hooks/use-establecimiento";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus, MapPinned, Droplets, Pencil, ArrowRight, Beef,
  BarChart3, Smartphone, Search, Filter, RefreshCw, X,
} from "lucide-react";
import { fmtNum, fmtDate } from "@/lib/format";
import { ExportMenu } from "@/components/data-io";
import { ConfirmDelete } from "@/components/confirm";
import { AttachmentsButton } from "@/components/attachments-dialog";

export const Route = createFileRoute("/_authenticated/potreros")({
  head: () => ({ meta: [{ title: "Potreros — Ganadero IA" }] }),
  component: PotrerosPage,
});

// ─── Types ───────────────────────────────────────────────────────────────────

type Potrero = {
  id: string; nombre: string; hectareas: number;
  tipo_suelo: string | null; tipo_pastura: string | null;
  aguadas: number; estado: string | null; observaciones: string | null;
};

type Animal = {
  id: string; caravana: string; sexo: string;
  peso_actual: number | null; estado_reproductivo: string | null;
  categoria: { nombre: string; ev: number } | null;
  raza: { nombre: string } | null;
  potrero_id: string | null;
};

type StockRow = {
  categoria: string; ev_unitario: number;
  machos: number; hembras: number; total: number; ev_total: number;
};

type PotreroCon = Potrero & {
  stockRows: StockRow[];
  totalAnimales: number;
  evTotal: number;
  evPorHa: number;
};

const ESTADOS_POTRERO = ["disponible", "descanso", "clausurado", "inundado", "en_uso"];

const emptyForm = {
  nombre: "", hectareas: "", tipo_suelo: "", tipo_pastura: "",
  aguadas: "0", estado: "disponible", observaciones: "",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

function PotrerosPage() {
  const { activeId, active } = useActiveEstablecimiento();
  if (!active) return <div className="p-8 text-muted-foreground">Seleccioná un establecimiento.</div>;
  return <PotrerosInner estId={activeId!} estNombre={active.nombre} />;
}

function PotrerosInner({ estId, estNombre }: { estId: string; estNombre: string }) {
  const [potreros, setPotreros] = useState<Potrero[]>([]);
  const [animalesTodos, setAnimalesTodos] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("resumen");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busquedaPotrero, setBusquedaPotrero] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");

  // Dialog CRUD
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Dialog Asignar
  const [asignarOpen, setAsignarOpen] = useState(false);
  const [asignarPotId, setAsignarPotId] = useState("");
  const [asignarCaravana, setAsignarCaravana] = useState("");
  const [asignarSaving, setAsignarSaving] = useState(false);

  // Dialog Traslado
  const [trasladoOpen, setTrasladoOpen] = useState(false);
  const [trasladoAnimal, setTrasladoAnimal] = useState<Animal | null>(null);
  const [trasladoDestId, setTrasladoDestId] = useState("");
  const [trasladoSaving, setTrasladoSaving] = useState(false);

  // Dialog Traslado masivo
  const [masivoOpen, setMasivoOpen] = useState(false);
  const [masivoOrigen, setMasivoOrigen] = useState("");
  const [masivoDest, setMasivoDest] = useState("");
  const [masivoFiltrosCat, setMasivoFiltrosCat] = useState<string[]>([]);
  const [masivoSaving, setMasivoSaving] = useState(false);

  // ── Carga de datos ──
  const loadAll = useCallback(async () => {
    setLoading(true);
    const [{ data: pots }, { data: anim }] = await Promise.all([
      supabase.from("potreros").select("*").eq("establecimiento_id", estId).order("nombre"),
      supabase.from("animales")
        .select("id, caravana, sexo, peso_actual, estado_reproductivo, potrero_id, categoria:categorias(nombre, ev), raza:razas(nombre)")
        .eq("establecimiento_id", estId).eq("estado", "activo"),
    ]);
    setPotreros((pots as Potrero[]) ?? []);
    setAnimalesTodos((anim as any) ?? []);
    setLoading(false);
  }, [estId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Calcular stock enriquecido ──
  const potrerosConStock = useMemo<PotreroCon[]>(() => {
    return potreros.map((p) => {
      const animPot = animalesTodos.filter((a) => a.potrero_id === p.id);
      const byCat: Record<string, StockRow> = {};
      for (const a of animPot) {
        const cat = a.categoria?.nombre ?? "Sin categoría";
        const ev = a.categoria?.ev ?? 1;
        if (!byCat[cat]) byCat[cat] = { categoria: cat, ev_unitario: ev, machos: 0, hembras: 0, total: 0, ev_total: 0 };
        if (a.sexo === "macho") byCat[cat].machos++;
        else byCat[cat].hembras++;
        byCat[cat].total++;
        byCat[cat].ev_total += ev;
      }
      const stockRows = Object.values(byCat).sort((a, b) => b.total - a.total);
      const evTotal = stockRows.reduce((s, r) => s + r.ev_total, 0);
      const evPorHa = p.hectareas > 0 ? evTotal / p.hectareas : 0;
      return { ...p, stockRows, totalAnimales: animPot.length, evTotal, evPorHa };
    });
  }, [potreros, animalesTodos]);

  // ── Filtros ──
  const potrerosFiltrados = useMemo(() => potrerosConStock.filter((p) => {
    const matchNombre = p.nombre.toLowerCase().includes(busquedaPotrero.toLowerCase());
    const matchEstado = filtroEstado === "todos" || p.estado === filtroEstado;
    return matchNombre && matchEstado;
  }), [potrerosConStock, busquedaPotrero, filtroEstado]);

  const selectedPotrero = potrerosConStock.find((p) => p.id === selectedId) ?? null;
  const animalesEnSelected = animalesTodos.filter((a) => a.potrero_id === selectedId);
  const sinPotrero = animalesTodos.filter((a) => !a.potrero_id);

  // ── Totales establecimiento ──
  const totalHa = potreros.reduce((s, p) => s + Number(p.hectareas), 0);
  const totalAnimales = animalesTodos.length;
  const totalEV = potrerosConStock.reduce((s, p) => s + p.evTotal, 0);
  const evPorHaTotal = totalHa > 0 ? totalEV / totalHa : 0;

  // ── CRUD Potrero ──
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) return toast.error("El nombre es requerido");
    setSaving(true);
    const payload = {
      establecimiento_id: estId,
      nombre: form.nombre.trim(),
      hectareas: Number(form.hectareas || 0),
      tipo_suelo: form.tipo_suelo || null,
      tipo_pastura: form.tipo_pastura || null,
      aguadas: Number(form.aguadas || 0),
      estado: form.estado || "disponible",
      observaciones: form.observaciones || null,
    };
    const { error } = editing
      ? await supabase.from("potreros").update(payload).eq("id", editing)
      : await supabase.from("potreros").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Potrero actualizado" : "Potrero creado");
    setOpen(false); setEditing(null); setForm(emptyForm);
    loadAll();
  }

  function openEdit(p: Potrero) {
    setEditing(p.id);
    setForm({
      nombre: p.nombre, hectareas: String(p.hectareas),
      tipo_suelo: p.tipo_suelo ?? "", tipo_pastura: p.tipo_pastura ?? "",
      aguadas: String(p.aguadas ?? 0), estado: p.estado ?? "disponible",
      observaciones: p.observaciones ?? "",
    });
    setOpen(true);
  }

  async function handleDelete(id: string) {
    // Desasignar animales antes de eliminar
    await supabase.from("animales").update({ potrero_id: null }).eq("potrero_id", id);
    const { error } = await supabase.from("potreros").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Potrero eliminado");
    if (selectedId === id) setSelectedId(null);
    loadAll();
  }

  // ── Asignar animal a potrero ──
  async function handleAsignar(e: React.FormEvent) {
    e.preventDefault();
    if (!asignarCaravana.trim() || !asignarPotId) return;
    setAsignarSaving(true);
    const { data: animal } = await supabase
      .from("animales").select("id, caravana, potrero_id")
      .eq("establecimiento_id", estId).ilike("caravana", asignarCaravana.trim())
      .limit(1).maybeSingle();
    if (!animal) {
      toast.error(`No se encontró caravana "${asignarCaravana}"`);
      setAsignarSaving(false); return;
    }
    const origenId = animal.potrero_id;
    await supabase.from("animales").update({ potrero_id: asignarPotId }).eq("id", animal.id);
    if (origenId !== asignarPotId) {
      await supabase.from("movimientos").insert({
        establecimiento_id: estId, animal_id: animal.id, tipo: "traslado",
        potrero_origen_id: origenId, potrero_destino_id: asignarPotId,
        fecha: new Date().toISOString().slice(0, 10),
        observaciones: `Asignación a ${potreros.find(p => p.id === asignarPotId)?.nombre}`,
      });
    }
    toast.success(`${animal.caravana} → ${potreros.find(p => p.id === asignarPotId)?.nombre}`);
    setAsignarSaving(false); setAsignarOpen(false); setAsignarCaravana(""); setAsignarPotId("");
    loadAll();
  }

  // ── Traslado individual ──
  async function handleTraslado(e: React.FormEvent) {
    e.preventDefault();
    if (!trasladoAnimal || !trasladoDestId) return;
    setTrasladoSaving(true);
    await supabase.from("animales").update({ potrero_id: trasladoDestId }).eq("id", trasladoAnimal.id);
    await supabase.from("movimientos").insert({
      establecimiento_id: estId, animal_id: trasladoAnimal.id, tipo: "traslado",
      potrero_origen_id: trasladoAnimal.potrero_id,
      potrero_destino_id: trasladoDestId,
      fecha: new Date().toISOString().slice(0, 10),
      observaciones: `Traslado ${selectedPotrero?.nombre ?? "?"} → ${potreros.find(p => p.id === trasladoDestId)?.nombre ?? "?"}`,
    });
    toast.success("Animal trasladado");
    setTrasladoSaving(false); setTrasladoOpen(false); setTrasladoAnimal(null); setTrasladoDestId("");
    loadAll();
  }

  // ── Traslado masivo ──
  async function handleMasivo(e: React.FormEvent) {
    e.preventDefault();
    if (!masivoOrigen || !masivoDest || masivoOrigen === masivoDest) return;
    setMasivoSaving(true);

    let query = supabase.from("animales").select("id").eq("potrero_id", masivoOrigen).eq("estado", "activo");
    if (masivoFiltrosCat.length > 0) {
      const { data: cats } = await supabase.from("categorias").select("id, nombre").in("nombre", masivoFiltrosCat);
      if (cats && cats.length > 0) query = (query as any).in("categoria_id", cats.map((c: any) => c.id));
    }

    const { data: animales } = await query;
    if (!animales || animales.length === 0) {
      toast.warning("No hay animales con esos criterios"); setMasivoSaving(false); return;
    }

    const ids = animales.map((a: any) => a.id);
    await supabase.from("animales").update({ potrero_id: masivoDest }).in("id", ids);

    const fecha = new Date().toISOString().slice(0, 10);
    await supabase.from("movimientos").insert(
      ids.map((id: string) => ({
        establecimiento_id: estId, animal_id: id, tipo: "traslado",
        potrero_origen_id: masivoOrigen, potrero_destino_id: masivoDest, fecha,
        observaciones: `Traslado masivo${masivoFiltrosCat.length ? ` (${masivoFiltrosCat.join(", ")})` : ""}`,
      }))
    );

    toast.success(`${ids.length} animales trasladados`);
    setMasivoSaving(false); setMasivoOpen(false);
    setMasivoOrigen(""); setMasivoDest(""); setMasivoFiltrosCat([]);
    loadAll();
  }

  const exportCols = [
    { key: "nombre", header: "nombre" },
    { key: "hectareas", header: "hectareas" },
    { key: "tipo_suelo", header: "tipo_suelo" },
    { key: "tipo_pastura", header: "tipo_pastura" },
    { key: "aguadas", header: "aguadas" },
    { key: "estado", header: "estado" },
    { key: "observaciones", header: "observaciones" },
  ];

  const catNames = [...new Set(animalesTodos.map(a => a.categoria?.nombre).filter(Boolean) as string[])].sort();

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Potreros</h1>
          <p className="text-muted-foreground text-sm">{estNombre}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setMasivoOpen(true)}>
            <ArrowRight className="h-4 w-4 mr-2" />Traslado masivo
          </Button>
          <Button variant="outline" onClick={() => { setAsignarPotId(""); setAsignarOpen(true); }}>
            <Beef className="h-4 w-4 mr-2" />Asignar animal
          </Button>
          <ExportMenu items={potreros} cols={exportCols} filename={`potreros_${estNombre}`} />
          <Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />Nuevo potrero
          </Button>
        </div>
      </div>

      {/* ── KPIs generales ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Potreros</div><div className="text-2xl font-bold mt-1">{potreros.length}</div><div className="text-xs text-muted-foreground">{fmtNum(totalHa)} ha totales</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Animales asignados</div><div className="text-2xl font-bold mt-1">{totalAnimales - sinPotrero.length}</div><div className="text-xs text-muted-foreground">{sinPotrero.length} sin potrero</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">EV totales</div><div className="text-2xl font-bold mt-1 tabular-nums">{fmtNum(totalEV, 1)}</div><div className="text-xs text-muted-foreground">en potreros</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Carga promedio</div><div className="text-2xl font-bold mt-1 tabular-nums">{fmtNum(evPorHaTotal, 2)}</div><div className="text-xs text-muted-foreground">EV/ha</div></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="resumen"><BarChart3 className="h-4 w-4 mr-1.5" />Resumen</TabsTrigger>
          <TabsTrigger value="potreros"><MapPinned className="h-4 w-4 mr-1.5" />Potreros</TabsTrigger>
          <TabsTrigger value="detalle">{selectedPotrero ? selectedPotrero.nombre : "Detalle"}</TabsTrigger>
          <TabsTrigger value="movil"><Smartphone className="h-4 w-4 mr-1.5" />Rápido</TabsTrigger>
        </TabsList>

        {/* ══ TAB: RESUMEN ══ */}
        <TabsContent value="resumen" className="mt-4 space-y-4">
          {potrerosConStock.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground">Sin potreros. Creá el primero.</Card>
          ) : (
            potrerosConStock.map((p) => (
              <Card key={p.id} className="overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <MapPinned className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{p.nombre}</span>
                    <Badge variant="outline">{p.totalAnimales} animales</Badge>
                    <span className="text-xs text-muted-foreground">{fmtNum(p.hectareas)} ha · {fmtNum(p.evPorHa, 2)} EV/ha</span>
                    {p.evTotal > 0 && <span className="text-xs text-muted-foreground">· {fmtNum(p.evTotal, 1)} EV totales</span>}
                  </div>
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setSelectedId(p.id); setTab("detalle"); }}>
                    Ver animales →
                  </Button>
                </div>
                {p.stockRows.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoría</TableHead>
                        <TableHead className="text-right">EV unit.</TableHead>
                        <TableHead className="text-center">♂ Machos</TableHead>
                        <TableHead className="text-center">♀ Hembras</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">EV total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {p.stockRows.map((r) => (
                        <TableRow key={r.categoria}>
                          <TableCell className="font-medium">{r.categoria}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{r.ev_unitario}</TableCell>
                          <TableCell className="text-center tabular-nums">{r.machos || "—"}</TableCell>
                          <TableCell className="text-center tabular-nums">{r.hembras || "—"}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{r.total}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{fmtNum(r.ev_total, 1)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold bg-muted/20">
                        <TableCell>TOTAL</TableCell>
                        <TableCell />
                        <TableCell className="text-center tabular-nums">{p.stockRows.reduce((s, r) => s + r.machos, 0)}</TableCell>
                        <TableCell className="text-center tabular-nums">{p.stockRows.reduce((s, r) => s + r.hembras, 0)}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.totalAnimales}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(p.evTotal, 1)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                ) : (
                  <div className="py-4 px-5 text-sm text-muted-foreground">Sin animales asignados.</div>
                )}
              </Card>
            ))
          )}

          {/* Animales sin potrero */}
          {sinPotrero.length > 0 && (
            <Card className="overflow-hidden border-amber-200 dark:border-amber-800">
              <div className="px-5 py-3 border-b bg-amber-50 dark:bg-amber-950/30 flex items-center justify-between">
                <span className="font-semibold text-amber-800 dark:text-amber-300">⚠ Sin potrero asignado ({sinPotrero.length})</span>
                <Button size="sm" variant="outline" onClick={() => setAsignarOpen(true)}>Asignar</Button>
              </div>
              <div className="px-5 py-3 text-sm text-muted-foreground">
                {sinPotrero.slice(0, 8).map(a => a.caravana).join(", ")}
                {sinPotrero.length > 8 && ` … y ${sinPotrero.length - 8} más`}
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ══ TAB: POTREROS (cards + filtros) ══ */}
        <TabsContent value="potreros" className="mt-4 space-y-4">
          {/* Filtros */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar potrero…" value={busquedaPotrero} onChange={(e) => setBusquedaPotrero(e.target.value)} />
            </div>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-44">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {ESTADOS_POTRERO.map(e => <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>)}
              </SelectContent>
            </Select>
            {(busquedaPotrero || filtroEstado !== "todos") && (
              <Button variant="ghost" size="icon" onClick={() => { setBusquedaPotrero(""); setFiltroEstado("todos"); }}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {loading ? (
            <div className="grid md:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-36 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {potrerosFiltrados.map((p) => (
                <Card
                  key={p.id}
                  className={`p-4 cursor-pointer transition-all border-2 ${selectedId === p.id && tab === "detalle" ? "border-primary" : "border-transparent hover:border-border"}`}
                  onClick={() => { setSelectedId(p.id); setTab("detalle"); }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{p.nombre}</h3>
                        {p.estado && p.estado !== "disponible" && (
                          <Badge variant={p.estado === "clausurado" || p.estado === "inundado" ? "destructive" : "secondary"} className="text-[10px]">
                            {p.estado}
                          </Badge>
                        )}
                      </div>
                      <p className="text-2xl font-bold text-primary">{fmtNum(p.hectareas)} <span className="text-sm font-normal text-muted-foreground">ha</span></p>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.tipo_pastura ?? p.tipo_suelo ?? "—"}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Beef className="h-3 w-3" />{p.totalAnimales} animales</span>
                        <span>{fmtNum(p.evPorHa, 2)} EV/ha</span>
                        <span className="flex items-center gap-1"><Droplets className="h-3 w-3" />{p.aguadas ?? 0}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <AttachmentsButton entityType="potrero" entityId={p.id} title={`${p.nombre}`} categoria="foto_potrero" />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <ConfirmDelete
                        title={`¿Eliminar ${p.nombre}?`}
                        description="Los animales quedarán sin potrero asignado."
                        onConfirm={() => handleDelete(p.id)}
                      />
                    </div>
                  </div>
                </Card>
              ))}
              {potrerosFiltrados.length === 0 && (
                <div className="col-span-3 text-center py-12 text-muted-foreground">
                  {potreros.length === 0 ? "Sin potreros creados aún." : "No hay potreros con esos filtros."}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ══ TAB: DETALLE de potrero ══ */}
        <TabsContent value="detalle" className="mt-4">
          {!selectedPotrero ? (
            <Card className="p-10 text-center text-muted-foreground">
              Seleccioná un potrero desde la pestaña "Potreros".
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Info del potrero */}
              <Card className="p-5">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">{selectedPotrero.nombre}</h2>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                      <span>{fmtNum(selectedPotrero.hectareas)} ha</span>
                      {selectedPotrero.tipo_pastura && <span>Pastura: {selectedPotrero.tipo_pastura}</span>}
                      {selectedPotrero.tipo_suelo && <span>Suelo: {selectedPotrero.tipo_suelo}</span>}
                      <span className="flex items-center gap-1"><Droplets className="h-3.5 w-3.5" />{selectedPotrero.aguadas ?? 0} aguadas</span>
                      <span>EV totales: {fmtNum(selectedPotrero.evTotal, 1)}</span>
                      <span>EV/ha: {fmtNum(selectedPotrero.evPorHa, 2)}</span>
                    </div>
                    {selectedPotrero.observaciones && <p className="text-sm text-muted-foreground mt-2">{selectedPotrero.observaciones}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(selectedPotrero)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />Editar potrero
                    </Button>
                    <Button size="sm" onClick={() => { setAsignarPotId(selectedId ?? ""); setAsignarOpen(true); }}>
                      <Plus className="h-3.5 w-3.5 mr-1" />Asignar animal
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Stock por categoría del potrero */}
              {selectedPotrero.stockRows.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedPotrero.stockRows.map((r) => (
                    <div key={r.categoria} className="bg-background border rounded-lg px-3 py-2 text-sm">
                      <span className="font-medium">{r.categoria}</span>
                      <span className="text-muted-foreground ml-2">
                        {r.machos > 0 && `♂${r.machos}`}
                        {r.machos > 0 && r.hembras > 0 && " "}
                        {r.hembras > 0 && `♀${r.hembras}`}
                        <span className="font-semibold text-foreground ml-1.5">= {r.total}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tabla de animales */}
              <Card className="overflow-hidden">
                <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
                  <span className="font-medium text-sm">{animalesEnSelected.length} animales activos</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setMasivoOrigen(selectedId ?? ""); setMasivoOpen(true); }}>
                      <ArrowRight className="h-3.5 w-3.5 mr-1" />Trasladar grupo
                    </Button>
                  </div>
                </div>
                {animalesEnSelected.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground text-sm">Sin animales asignados.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Caravana</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Sexo</TableHead>
                        <TableHead>Raza</TableHead>
                        <TableHead>Reprod.</TableHead>
                        <TableHead className="text-right">Peso (kg)</TableHead>
                        <TableHead className="text-right">Traslado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {animalesEnSelected.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-mono font-medium">{a.caravana}</TableCell>
                          <TableCell>{a.categoria?.nombre ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant={a.sexo === "macho" ? "default" : "secondary"} className="text-xs">
                              {a.sexo === "macho" ? "♂" : "♀"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{a.raza?.nombre ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground text-xs capitalize">{a.estado_reproductivo ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{a.peso_actual ? fmtNum(a.peso_actual, 1) : "—"}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                              onClick={() => { setTrasladoAnimal(a); setTrasladoDestId(""); setTrasladoOpen(true); }}>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ══ TAB: VISTA RÁPIDA MÓVIL ══ */}
        <TabsContent value="movil" className="mt-4">
          <div className="max-w-sm space-y-3">
            <p className="text-sm text-muted-foreground mb-4">Vista compacta para el campo. Un toque para trasladar.</p>
            {potrerosConStock.map((p) => (
              <Card key={p.id} className="p-4" onClick={() => { setSelectedId(p.id); setTab("detalle"); }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-lg">{p.nombre}</p>
                    <p className="text-xs text-muted-foreground">{fmtNum(p.hectareas)} ha</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold tabular-nums">{p.totalAnimales}</p>
                    <p className="text-xs text-muted-foreground">{fmtNum(p.evPorHa, 2)} EV/ha</p>
                  </div>
                </div>
                {p.stockRows.length > 0 && (
                  <div className="mt-2 pt-2 border-t space-y-0.5">
                    {p.stockRows.map(r => (
                      <div key={r.categoria} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{r.categoria}</span>
                        <span className="font-medium tabular-nums">{r.total}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
            {potrerosConStock.length === 0 && (
              <Card className="p-8 text-center text-muted-foreground text-sm">Sin potreros aún.</Card>
            )}
            <Button className="w-full h-14 text-base" onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true); }}>
              <Plus className="h-5 w-5 mr-2" />Nuevo potrero
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* ══ Dialogs ══ */}

      {/* CRUD Potrero */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar potrero" : "Nuevo potrero"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Nombre *</Label><Input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
              <div><Label>Hectáreas</Label><Input type="number" step="0.01" min="0" value={form.hectareas} onChange={(e) => setForm({ ...form, hectareas: e.target.value })} /></div>
              <div><Label>Aguadas</Label><Input type="number" min="0" value={form.aguadas} onChange={(e) => setForm({ ...form, aguadas: e.target.value })} /></div>
              <div><Label>Tipo de suelo</Label><Input value={form.tipo_suelo} onChange={(e) => setForm({ ...form, tipo_suelo: e.target.value })} /></div>
              <div><Label>Pastura</Label><Input value={form.tipo_pastura} placeholder="Gatton, Grama, Tifton…" onChange={(e) => setForm({ ...form, tipo_pastura: e.target.value })} /></div>
              <div className="col-span-2">
                <Label>Estado</Label>
                <Select value={form.estado} onValueChange={(v) => setForm({ ...form, estado: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ESTADOS_POTRERO.map(e => <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>Observaciones</Label><Textarea rows={2} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></div>
            </div>
            <DialogFooter><Button type="submit" disabled={saving} className="w-full">{saving ? "Guardando…" : editing ? "Guardar" : "Crear potrero"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Asignar animal */}
      <Dialog open={asignarOpen} onOpenChange={setAsignarOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Asignar animal a potrero</DialogTitle></DialogHeader>
          <form onSubmit={handleAsignar} className="space-y-4">
            <div><Label>Caravana *</Label><Input required value={asignarCaravana} onChange={(e) => setAsignarCaravana(e.target.value)} placeholder="Número de caravana" className="font-mono" /></div>
            <div>
              <Label>Potrero destino *</Label>
              <Select value={asignarPotId} onValueChange={setAsignarPotId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                <SelectContent>{potreros.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre} ({fmtNum(p.hectareas)} ha)</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setAsignarOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={asignarSaving || !asignarCaravana || !asignarPotId}>{asignarSaving ? "Buscando…" : "Asignar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Traslado individual */}
      <Dialog open={trasladoOpen} onOpenChange={setTrasladoOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Trasladar animal</DialogTitle></DialogHeader>
          <form onSubmit={handleTraslado} className="space-y-4">
            <div>
              <Label>Animal</Label>
              <p className="font-mono font-bold text-lg">{trasladoAnimal?.caravana}</p>
              <p className="text-xs text-muted-foreground">{trasladoAnimal?.categoria?.nombre} · Origen: {selectedPotrero?.nombre}</p>
            </div>
            <div>
              <Label>Potrero destino *</Label>
              <Select value={trasladoDestId} onValueChange={setTrasladoDestId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                <SelectContent>{potreros.filter(p => p.id !== selectedId).map(p => <SelectItem key={p.id} value={p.id}>{p.nombre} ({fmtNum(p.hectareas)} ha)</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setTrasladoOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={trasladoSaving || !trasladoDestId}><ArrowRight className="h-4 w-4 mr-2" />{trasladoSaving ? "Trasladando…" : "Confirmar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Traslado masivo */}
      <Dialog open={masivoOpen} onOpenChange={setMasivoOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Traslado masivo</DialogTitle></DialogHeader>
          <form onSubmit={handleMasivo} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Potrero origen *</Label>
                <Select value={masivoOrigen} onValueChange={setMasivoOrigen}>
                  <SelectTrigger><SelectValue placeholder="Origen…" /></SelectTrigger>
                  <SelectContent>{potreros.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Potrero destino *</Label>
                <Select value={masivoDest} onValueChange={setMasivoDest}>
                  <SelectTrigger><SelectValue placeholder="Destino…" /></SelectTrigger>
                  <SelectContent>{potreros.filter(p => p.id !== masivoOrigen).map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Filtrar por categoría (opcional)</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {catNames.map(cat => (
                  <button
                    key={cat} type="button"
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${masivoFiltrosCat.includes(cat) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                    onClick={() => setMasivoFiltrosCat(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {masivoFiltrosCat.length === 0 ? "Se trasladarán TODOS los animales del potrero origen." : `Solo se trasladarán: ${masivoFiltrosCat.join(", ")}`}
              </p>
            </div>
            {masivoOrigen && (
              <div className="bg-muted/40 rounded-lg px-4 py-3 text-sm">
                <strong>{potrerosConStock.find(p => p.id === masivoOrigen)?.totalAnimales ?? 0} animales</strong> en {potreros.find(p => p.id === masivoOrigen)?.nombre}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setMasivoOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={masivoSaving || !masivoOrigen || !masivoDest}>{masivoSaving ? "Trasladando…" : "Confirmar traslado"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
