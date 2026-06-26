import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { toast } from "sonner";
import { Plus, Droplets, Fence, Pencil } from "lucide-react";
import { fmtNum } from "@/lib/format";
import { ConfirmDelete } from "@/components/confirm";

export const Route = createFileRoute("/_authenticated/infraestructura")({
  head: () => ({ meta: [{ title: "Infraestructura — Ganadero IA" }] }),
  component: InfraestructuraPage,
});

type Aguada = {
  id: string; nombre: string; tipo: string; estado: string;
  potrero_id: string | null; capacidad_litros: number | null; observaciones: string | null;
};
type Alambrado = {
  id: string; nombre: string; tipo: string; km: number;
  hilos: number | null; estado: string; observaciones: string | null;
};
type Potrero = { id: string; nombre: string };

const TIPOS_AGUADA = ["represa", "molino", "tanque", "aljibe", "otro"];
const TIPOS_ALAMBRADO = ["alambrado", "electrico", "mixto", "boyero"];
const ESTADOS_AGUADA = ["activo", "en_reparacion", "inactivo"];
const ESTADOS = ["bueno", "regular", "malo", "en_reparacion"];

const estadoVariant = (e: string) =>
  e === "bueno" || e === "activo" ? "default"
  : e === "regular" ? "secondary"
  : "destructive";

function InfraestructuraPage() {
  const { activeId, active } = useActiveEstablecimiento();
  if (!active) return <div className="p-8">Seleccioná un establecimiento.</div>;
  return <InfraestructuraInner estId={activeId!} estNombre={active.nombre} />;
}

function InfraestructuraInner({ estId, estNombre }: { estId: string; estNombre: string }) {
  const [aguadas, setAguadas] = useState<Aguada[]>([]);
  const [alambrados, setAlambrados] = useState<Alambrado[]>([]);
  const [potreros, setPotreros] = useState<Potrero[]>([]);

  // Aguada form
  const [aguadaOpen, setAguadaOpen] = useState(false);
  const [aguadaEdit, setAguadaEdit] = useState<string | null>(null);
  const [aguadaForm, setAguadaForm] = useState({ nombre: "", tipo: "represa", estado: "activo", potrero_id: "", capacidad_litros: "", observaciones: "" });

  // Alambrado form
  const [alambOpen, setAlambOpen] = useState(false);
  const [alambEdit, setAlambEdit] = useState<string | null>(null);
  const [alambForm, setAlambForm] = useState({ nombre: "", tipo: "alambrado", km: "", hilos: "", estado: "bueno", observaciones: "" });
  const [saving, setSaving] = useState(false);

  async function loadAguadas() {
    const { data } = await supabase.from("aguadas").select("*").eq("establecimiento_id", estId).order("nombre");
    setAguadas((data as Aguada[]) ?? []);
  }
  async function loadAlambrados() {
    const { data } = await supabase.from("alambrados").select("*").eq("establecimiento_id", estId).order("nombre");
    setAlambrados((data as Alambrado[]) ?? []);
  }
  useEffect(() => {
    loadAguadas(); loadAlambrados();
    supabase.from("potreros").select("id, nombre").eq("establecimiento_id", estId).order("nombre")
      .then(({ data }) => setPotreros(data ?? []));
  }, [estId]);

  // ── CRUD Aguadas ──
  async function saveAguada(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    const payload = {
      establecimiento_id: estId, nombre: aguadaForm.nombre, tipo: aguadaForm.tipo, estado: aguadaForm.estado,
      potrero_id: aguadaForm.potrero_id || null,
      capacidad_litros: aguadaForm.capacidad_litros ? Number(aguadaForm.capacidad_litros) : null,
      observaciones: aguadaForm.observaciones || null,
    };
    const { error } = aguadaEdit
      ? await supabase.from("aguadas").update(payload).eq("id", aguadaEdit)
      : await supabase.from("aguadas").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(aguadaEdit ? "Aguada actualizada" : "Aguada registrada");
    setAguadaOpen(false); setAguadaEdit(null);
    setAguadaForm({ nombre: "", tipo: "represa", estado: "activo", potrero_id: "", capacidad_litros: "", observaciones: "" });
    loadAguadas();
  }

  async function deleteAguada(id: string) {
    const { error } = await supabase.from("aguadas").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Aguada eliminada"); loadAguadas();
  }

  // ── CRUD Alambrados ──
  async function saveAlambrado(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    const payload = {
      establecimiento_id: estId, nombre: alambForm.nombre, tipo: alambForm.tipo,
      km: Number(alambForm.km || 0), hilos: alambForm.hilos ? Number(alambForm.hilos) : null,
      estado: alambForm.estado, observaciones: alambForm.observaciones || null,
    };
    const { error } = alambEdit
      ? await supabase.from("alambrados").update(payload).eq("id", alambEdit)
      : await supabase.from("alambrados").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(alambEdit ? "Alambrado actualizado" : "Alambrado registrado");
    setAlambOpen(false); setAlambEdit(null);
    setAlambForm({ nombre: "", tipo: "alambrado", km: "", hilos: "", estado: "bueno", observaciones: "" });
    loadAlambrados();
  }

  async function deleteAlambrado(id: string) {
    const { error } = await supabase.from("alambrados").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Alambrado eliminado"); loadAlambrados();
  }

  const potMap = new Map(potreros.map(p => [p.id, p.nombre]));
  const kmTotal = alambrados.reduce((s, a) => s + Number(a.km), 0);
  const kmMalo = alambrados.filter(a => a.estado === "malo" || a.estado === "en_reparacion").reduce((s, a) => s + Number(a.km), 0);

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Infraestructura</h1>
        <p className="text-muted-foreground text-sm">Aguadas y alambrados · {estNombre}</p>
      </div>

      {/* KPIs resumen */}
      <div className="grid md:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Aguadas activas</div><div className="text-2xl font-bold mt-1">{aguadas.filter(a => a.estado === "activo").length} <span className="text-sm font-normal text-muted-foreground">/ {aguadas.length}</span></div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">En reparación</div><div className="text-2xl font-bold mt-1 text-amber-600">{aguadas.filter(a => a.estado === "en_reparacion").length}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">km alambrado total</div><div className="text-2xl font-bold mt-1 tabular-nums">{fmtNum(kmTotal, 1)}</div></Card>
        <Card className={`p-4 ${kmMalo > 0 ? "border-destructive/40 bg-destructive/5" : ""}`}><div className="text-xs text-muted-foreground">km en mal estado</div><div className={`text-2xl font-bold mt-1 tabular-nums ${kmMalo > 0 ? "text-destructive" : ""}`}>{fmtNum(kmMalo, 1)}</div></Card>
      </div>

      <Tabs defaultValue="aguadas">
        <TabsList>
          <TabsTrigger value="aguadas"><Droplets className="h-4 w-4 mr-1.5" />Aguadas ({aguadas.length})</TabsTrigger>
          <TabsTrigger value="alambrados"><Fence className="h-4 w-4 mr-1.5" />Alambrados ({alambrados.length})</TabsTrigger>
        </TabsList>

        {/* AGUADAS */}
        <TabsContent value="aguadas" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button onClick={() => { setAguadaEdit(null); setAguadaOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />Nueva aguada
            </Button>
          </div>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Potrero</TableHead>
                  <TableHead className="text-right">Capacidad (l)</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Observaciones</TableHead>
                  <TableHead className="w-20 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aguadas.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.nombre}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{a.tipo}</TableCell>
                    <TableCell className="text-muted-foreground">{potMap.get(a.potrero_id ?? "") ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.capacidad_litros ? fmtNum(a.capacidad_litros, 0) : "—"}</TableCell>
                    <TableCell><Badge variant={estadoVariant(a.estado)} className="text-xs capitalize">{a.estado.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">{a.observaciones ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                          setAguadaEdit(a.id);
                          setAguadaForm({ nombre: a.nombre, tipo: a.tipo, estado: a.estado, potrero_id: a.potrero_id ?? "", capacidad_litros: a.capacidad_litros ? String(a.capacidad_litros) : "", observaciones: a.observaciones ?? "" });
                          setAguadaOpen(true);
                        }}><Pencil className="h-3.5 w-3.5" /></Button>
                        <ConfirmDelete title={`¿Eliminar "${a.nombre}"?`} description="Esto no se puede deshacer." onConfirm={() => deleteAguada(a.id)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {aguadas.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Sin aguadas registradas.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ALAMBRADOS */}
        <TabsContent value="alambrados" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button onClick={() => { setAlambEdit(null); setAlambOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />Nuevo alambrado
            </Button>
          </div>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre / Sección</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">km</TableHead>
                  <TableHead className="text-right">Hilos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Observaciones</TableHead>
                  <TableHead className="w-20 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alambrados.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.nombre}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{a.tipo}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{fmtNum(a.km, 2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.hilos ?? "—"}</TableCell>
                    <TableCell><Badge variant={estadoVariant(a.estado)} className="text-xs capitalize">{a.estado.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">{a.observaciones ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                          setAlambEdit(a.id);
                          setAlambForm({ nombre: a.nombre, tipo: a.tipo, km: String(a.km), hilos: a.hilos ? String(a.hilos) : "", estado: a.estado, observaciones: a.observaciones ?? "" });
                          setAlambOpen(true);
                        }}><Pencil className="h-3.5 w-3.5" /></Button>
                        <ConfirmDelete title={`¿Eliminar "${a.nombre}"?`} description="Esto no se puede deshacer." onConfirm={() => deleteAlambrado(a.id)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {alambrados.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Sin alambrados registrados.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Aguada */}
      <Dialog open={aguadaOpen} onOpenChange={(v) => { setAguadaOpen(v); if (!v) setAguadaEdit(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{aguadaEdit ? "Editar aguada" : "Nueva aguada"}</DialogTitle></DialogHeader>
          <form onSubmit={saveAguada} className="space-y-3">
            <div><Label>Nombre *</Label><Input required value={aguadaForm.nombre} onChange={(e) => setAguadaForm({ ...aguadaForm, nombre: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label>
                <Select value={aguadaForm.tipo} onValueChange={(v) => setAguadaForm({ ...aguadaForm, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS_AGUADA.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Estado</Label>
                <Select value={aguadaForm.estado} onValueChange={(v) => setAguadaForm({ ...aguadaForm, estado: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ESTADOS_AGUADA.map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace("_", " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Potrero</Label>
                <Select value={aguadaForm.potrero_id || "_"} onValueChange={(v) => setAguadaForm({ ...aguadaForm, potrero_id: v === "_" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent><SelectItem value="_">—</SelectItem>{potreros.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Capacidad (litros)</Label><Input type="number" value={aguadaForm.capacidad_litros} onChange={(e) => setAguadaForm({ ...aguadaForm, capacidad_litros: e.target.value })} /></div>
            </div>
            <div><Label>Observaciones</Label><Textarea rows={2} value={aguadaForm.observaciones} onChange={(e) => setAguadaForm({ ...aguadaForm, observaciones: e.target.value })} /></div>
            <DialogFooter><Button type="submit" disabled={saving} className="w-full">{saving ? "Guardando…" : aguadaEdit ? "Guardar" : "Registrar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Alambrado */}
      <Dialog open={alambOpen} onOpenChange={(v) => { setAlambOpen(v); if (!v) setAlambEdit(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{alambEdit ? "Editar alambrado" : "Nuevo alambrado"}</DialogTitle></DialogHeader>
          <form onSubmit={saveAlambrado} className="space-y-3">
            <div><Label>Nombre / Sección *</Label><Input required value={alambForm.nombre} onChange={(e) => setAlambForm({ ...alambForm, nombre: e.target.value })} placeholder="Ej: Norte campo 1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label>
                <Select value={alambForm.tipo} onValueChange={(v) => setAlambForm({ ...alambForm, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS_ALAMBRADO.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Estado</Label>
                <Select value={alambForm.estado} onValueChange={(v) => setAlambForm({ ...alambForm, estado: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ESTADOS.map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace("_", " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Kilómetros</Label><Input type="number" step="0.01" min="0" value={alambForm.km} onChange={(e) => setAlambForm({ ...alambForm, km: e.target.value })} /></div>
              <div><Label>Hilos</Label><Input type="number" min="1" max="10" value={alambForm.hilos} onChange={(e) => setAlambForm({ ...alambForm, hilos: e.target.value })} /></div>
            </div>
            <div><Label>Observaciones</Label><Textarea rows={2} value={alambForm.observaciones} onChange={(e) => setAlambForm({ ...alambForm, observaciones: e.target.value })} /></div>
            <DialogFooter><Button type="submit" disabled={saving} className="w-full">{saving ? "Guardando…" : alambEdit ? "Guardar" : "Registrar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
