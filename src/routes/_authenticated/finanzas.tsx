import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEstablecimiento } from "@/hooks/use-establecimiento";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { fmtDate, fmtNum } from "@/lib/format";
import { Plus, TrendingUp, TrendingDown, Wallet, Pencil } from "lucide-react";
import { ExportMenu } from "@/components/data-io";
import { ConfirmDelete } from "@/components/confirm";

export const Route = createFileRoute("/_authenticated/finanzas")({
  head: () => ({ meta: [{ title: "Finanzas — Ganadero IA" }] }),
  component: FinanzasPage,
});

type Movimiento = {
  id: string;
  tipo: "ingreso" | "egreso";
  concepto: string;
  monto: number;
  moneda: string;
  fecha: string;
  categoria_id: string | null;
  observaciones: string | null;
  cantidad: number | null;
  unidad: string | null;
};

type Categoria = { id: string; nombre: string; tipo: string };

const emptyForm = {
  tipo: "ingreso",
  concepto: "",
  monto: "",
  moneda: "ARS",
  cantidad: "",
  unidad: "",
  fecha: new Date().toISOString().slice(0, 10),
  categoria_id: "",
  observaciones: "",
};

function FinanzasPage() {
  const { activeId, active } = useActiveEstablecimiento();
  if (!active) return <div className="p-8">Seleccioná un establecimiento.</div>;
  return <FinanzasInner estId={activeId!} estNombre={active.nombre} />;
}

function FinanzasInner({ estId, estNombre }: { estId: string; estNombre: string }) {
  const [items, setItems] = useState<Movimiento[]>([]);
  const [cats, setCats] = useState<Categoria[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [catEdit, setCatEdit] = useState<string | null>(null);
  const [catForm, setCatForm] = useState({ nombre: "", tipo: "ingreso" });
  const [catSaving, setCatSaving] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "ingreso" | "egreso">("todos");

  async function load() {
    const { data } = await supabase
      .from("finanzas_movimientos")
      .select("id, tipo, concepto, monto, moneda, fecha, categoria_id, observaciones, cantidad, unidad")
      .eq("establecimiento_id", estId)
      .order("fecha", { ascending: false })
      .limit(500);
    setItems((data as Movimiento[]) ?? []);
  }

  async function loadCats() {
    const { data } = await supabase
      .from("finanzas_categorias")
      .select("id, nombre, tipo")
      .eq("establecimiento_id", estId)
      .order("tipo,nombre");
    const loaded = data ?? [];
    setCats(loaded);
    // Si no hay categorías, crear las predeterminadas
    if (loaded.length === 0) {
      await seedDefaultCategories();
    }
  }

  async function seedDefaultCategories() {
    const defaults = [
      { nombre: "Venta de hacienda", tipo: "ingreso" },
      { nombre: "Venta de reproductores", tipo: "ingreso" },
      { nombre: "Venta de subproductos", tipo: "ingreso" },
      { nombre: "Subsidios / ayudas", tipo: "ingreso" },
      { nombre: "Otros ingresos", tipo: "ingreso" },
      { nombre: "Compra de hacienda", tipo: "egreso" },
      { nombre: "Sanidad y veterinaria", tipo: "egreso" },
      { nombre: "Alimentación", tipo: "egreso" },
      { nombre: "Mano de obra", tipo: "egreso" },
      { nombre: "Mantenimiento", tipo: "egreso" },
      { nombre: "Fletes y logística", tipo: "egreso" },
      { nombre: "Semillas y pasturas", tipo: "egreso" },
      { nombre: "Impuestos y tasas", tipo: "egreso" },
      { nombre: "Otros egresos", tipo: "egreso" },
    ];
    await supabase.from("finanzas_categorias").insert(
      defaults.map(d => ({ ...d, establecimiento_id: estId }))
    );
    const { data } = await supabase.from("finanzas_categorias").select("id, nombre, tipo").eq("establecimiento_id", estId).order("tipo,nombre");
    setCats(data ?? []);
  }

  useEffect(() => { load(); loadCats(); }, [estId]);

  async function saveCat(e: React.FormEvent) {
    e.preventDefault(); setCatSaving(true);
    const { error } = catEdit
      ? await supabase.from("finanzas_categorias").update({ nombre: catForm.nombre, tipo: catForm.tipo }).eq("id", catEdit)
      : await supabase.from("finanzas_categorias").insert({ establecimiento_id: estId, nombre: catForm.nombre, tipo: catForm.tipo });
    setCatSaving(false);
    if (error) return toast.error(error.message);
    toast.success(catEdit ? "Categoría actualizada" : "Categoría creada");
    setCatOpen(false); setCatEdit(null); setCatForm({ nombre: "", tipo: "ingreso" });
    loadCats();
  }

  async function deleteCat(id: string) {
    const { error } = await supabase.from("finanzas_categorias").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Categoría eliminada"); loadCats();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.concepto.trim() || !form.monto) return toast.error("Completá concepto y monto");
    setSaving(true);
    const { data: user } = await supabase.auth.getUser();
    const payload = {
      establecimiento_id: estId,
      tipo: form.tipo,
      concepto: form.concepto.trim(),
      monto: Number(form.monto),
      moneda: form.moneda,
      fecha: form.fecha,
      categoria_id: form.categoria_id || null,
      observaciones: form.observaciones || null,
      cantidad: form.cantidad ? Number(form.cantidad) : null,
      unidad: form.unidad || null,
      user_id: user.user?.id ?? null,
    };
    const { error } = editing
      ? await supabase.from("finanzas_movimientos").update(payload).eq("id", editing)
      : await supabase.from("finanzas_movimientos").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Movimiento actualizado" : "Movimiento registrado");
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
    load();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("finanzas_movimientos").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Eliminado");
    load();
  }

  function openNew(tipo?: "ingreso" | "egreso") {
    setEditing(null);
    setForm({ ...emptyForm, tipo: tipo ?? "ingreso" });
    setOpen(true);
  }

  function openEdit(m: Movimiento) {
    setEditing(m.id);
    setForm({
      tipo: m.tipo,
      concepto: m.concepto,
      monto: String(m.monto),
      moneda: m.moneda,
      fecha: m.fecha,
      categoria_id: m.categoria_id ?? "",
      observaciones: m.observaciones ?? "",
      cantidad: m.cantidad ? String(m.cantidad) : "",
      unidad: m.unidad ?? "",
    });
    setOpen(true);
  }

  const stats = useMemo(() => {
    const ingresos = items.filter((i) => i.tipo === "ingreso").reduce((s, i) => s + Number(i.monto), 0);
    const egresos = items.filter((i) => i.tipo === "egreso").reduce((s, i) => s + Number(i.monto), 0);
    return { ingresos, egresos, margen: ingresos - egresos };
  }, [items]);

  const catMap = new Map(cats.map((c) => [c.id, c.nombre]));
  const filtered = items.filter((i) => filtroTipo === "todos" || i.tipo === filtroTipo);

  const exportCols = [
    { key: "fecha", header: "fecha" },
    { key: "tipo", header: "tipo" },
    { key: "concepto", header: "concepto" },
    { key: "monto", header: "monto" },
    { key: "moneda", header: "moneda" },
    { key: "categoria_id", header: "categoria", get: (m: Movimiento) => catMap.get(m.categoria_id ?? "") ?? "" },
    { key: "observaciones", header: "observaciones" },
  ];

  const catsIngreso = cats.filter((c) => c.tipo === "ingreso");
  const catsEgreso = cats.filter((c) => c.tipo === "egreso");
  const catsActuales = form.tipo === "ingreso" ? catsIngreso : catsEgreso;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Finanzas</h1>
          <p className="text-muted-foreground text-sm">Ingresos y egresos de {estNombre}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExportMenu items={filtered} cols={exportCols} filename={`finanzas_${estNombre}`} />
          <Button variant="outline" onClick={() => openNew("egreso")} className="border-destructive/40 text-destructive hover:bg-destructive/5">
            <TrendingDown className="h-4 w-4 mr-2" />Egreso
          </Button>
          <Button onClick={() => openNew("ingreso")}>
            <TrendingUp className="h-4 w-4 mr-2" />Ingreso
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid md:grid-cols-3 gap-3">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Ingresos</div>
              <div className="text-2xl font-semibold mt-1 text-emerald-700 dark:text-emerald-400 tabular-nums">
                $ {fmtNum(stats.ingresos, 0)}
              </div>
            </div>
            <TrendingUp className="h-5 w-5 text-emerald-600" />
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Egresos</div>
              <div className="text-2xl font-semibold mt-1 text-destructive tabular-nums">
                $ {fmtNum(stats.egresos, 0)}
              </div>
            </div>
            <TrendingDown className="h-5 w-5 text-destructive" />
          </div>
        </Card>
        <Card className={`p-5 ${stats.margen >= 0 ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800" : "bg-destructive/5 border-destructive/20"}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Margen bruto</div>
              <div className={`text-2xl font-semibold mt-1 tabular-nums ${stats.margen >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}>
                $ {fmtNum(stats.margen, 0)}
              </div>
            </div>
            <Wallet className={`h-5 w-5 ${stats.margen >= 0 ? "text-emerald-600" : "text-destructive"}`} />
          </div>
        </Card>
      </div>

      {/* Filtro */}
      <Tabs value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as any)}>
        <TabsList>
          <TabsTrigger value="todos">Todos ({items.length})</TabsTrigger>
          <TabsTrigger value="ingreso">Ingresos ({items.filter((i) => i.tipo === "ingreso").length})</TabsTrigger>
          <TabsTrigger value="egreso">Egresos ({items.filter((i) => i.tipo === "egreso").length})</TabsTrigger>
          <TabsTrigger value="categorias">Categorías ({cats.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Gestión de categorías */}
      {filtroTipo === "categorias" && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Categorías de {estNombre}</h3>
            <Button size="sm" onClick={() => { setCatEdit(null); setCatForm({ nombre: "", tipo: "ingreso" }); setCatOpen(true); }}>
              <Plus className="h-4 w-4 mr-1.5" />Nueva
            </Button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {["ingreso", "egreso"].map((tipo) => (
              <div key={tipo}>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{tipo === "ingreso" ? "↑ Ingresos" : "↓ Egresos"}</div>
                <div className="space-y-1">
                  {cats.filter(c => c.tipo === tipo).map(c => (
                    <div key={c.id} className="flex items-center justify-between px-3 py-2 border rounded-md text-sm">
                      <span>{c.nombre}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setCatEdit(c.id); setCatForm({ nombre: c.nombre, tipo: c.tipo }); setCatOpen(true); }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </Button>
                        <ConfirmDelete title={`¿Eliminar "${c.nombre}"?`} description="Los movimientos con esta categoría quedarán sin categorizar." onConfirm={() => deleteCat(c.id)} />
                      </div>
                    </div>
                  ))}
                  {cats.filter(c => c.tipo === tipo).length === 0 && (
                    <p className="text-xs text-muted-foreground px-3 py-2">Sin categorías de {tipo}.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tabla */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="w-20 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="tabular-nums">{fmtDate(m.fecha)}</TableCell>
                <TableCell>
                  <Badge variant={m.tipo === "ingreso" ? "default" : "destructive"} className="text-xs">
                    {m.tipo === "ingreso" ? "↑ Ingreso" : "↓ Egreso"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{m.concepto}</div>
                  {m.observaciones && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{m.observaciones}</div>}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{catMap.get(m.categoria_id ?? "") ?? "—"}</TableCell>
                <TableCell className={`text-right font-semibold tabular-nums ${m.tipo === "ingreso" ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}>
                  {m.tipo === "egreso" ? "−" : "+"}$ {fmtNum(Number(m.monto), 0)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <ConfirmDelete
                      title={`¿Eliminar "${m.concepto}"?`}
                      description="Esta acción no se puede deshacer."
                      onConfirm={() => handleDelete(m.id)}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  Sin movimientos. ¡Registrá el primero!
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Dialog categoría */}
      <Dialog open={catOpen} onOpenChange={(v) => { setCatOpen(v); if (!v) { setCatEdit(null); setCatForm({ nombre: "", tipo: "ingreso" }); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{catEdit ? "Editar categoría" : "Nueva categoría"}</DialogTitle></DialogHeader>
          <form onSubmit={saveCat} className="space-y-3">
            <div><Label>Nombre *</Label><Input required value={catForm.nombre} onChange={(e) => setCatForm({ ...catForm, nombre: e.target.value })} /></div>
            <div><Label>Tipo</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Button type="button" variant={catForm.tipo === "ingreso" ? "default" : "outline"} onClick={() => setCatForm({ ...catForm, tipo: "ingreso" })}>↑ Ingreso</Button>
                <Button type="button" variant={catForm.tipo === "egreso" ? "destructive" : "outline"} onClick={() => setCatForm({ ...catForm, tipo: "egreso" })}>↓ Egreso</Button>
              </div>
            </div>
            <DialogFooter><Button type="submit" disabled={catSaving} className="w-full">{catSaving ? "Guardando…" : catEdit ? "Guardar" : "Crear"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog nuevo/editar */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar movimiento" : "Nuevo movimiento"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            {/* Tipo */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={form.tipo === "ingreso" ? "default" : "outline"}
                className="h-12"
                onClick={() => setForm({ ...form, tipo: "ingreso", categoria_id: "" })}
              >
                <TrendingUp className="h-4 w-4 mr-2" />Ingreso
              </Button>
              <Button
                type="button"
                variant={form.tipo === "egreso" ? "destructive" : "outline"}
                className="h-12"
                onClick={() => setForm({ ...form, tipo: "egreso", categoria_id: "" })}
              >
                <TrendingDown className="h-4 w-4 mr-2" />Egreso
              </Button>
            </div>

            <div>
              <Label>Concepto *</Label>
              <Input required value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} placeholder="Venta terneros, Compra de alimento…" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Monto *</Label>
                <Input required type="number" step="0.01" min="0" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} className="tabular-nums" />
              </div>
              <div>
                <Label>Moneda</Label>
                <Select value={form.moneda} onValueChange={(v) => setForm({ ...form, moneda: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">ARS $</SelectItem>
                    <SelectItem value="USD">USD u$s</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cantidad</Label>
                <Input type="number" step="0.01" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} placeholder="ej: 10" />
              </div>
              <div>
                <Label>Unidad</Label>
                <Input value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })} placeholder="cabezas, kg, litros…" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha</Label>
                <Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
              </div>
              <div>
                <Label>Categoría</Label>
                <Select
                  value={form.categoria_id || "_"}
                  onValueChange={(v) => setForm({ ...form, categoria_id: v === "_" ? "" : v })}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">—</SelectItem>
                    {catsActuales.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Observaciones</Label>
              <Textarea rows={2} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={saving} className="w-full h-11">
                {saving ? "Guardando…" : editing ? "Guardar cambios" : `Registrar ${form.tipo}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
