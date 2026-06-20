import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEstablecimiento } from "@/hooks/use-establecimiento";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";
import { ExportMenu } from "@/components/data-io";
import { ConfirmDelete } from "@/components/confirm";

export const Route = createFileRoute("/_authenticated/sanidad")({
  head: () => ({ meta: [{ title: "Sanidad — Ganadero IA" }] }),
  component: SanidadPage,
});

function SanidadPage() {
  const { activeId, active } = useActiveEstablecimiento();
  if (!active) return <div className="p-8">Seleccioná un establecimiento.</div>;
  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Sanidad</h1>
        <p className="text-muted-foreground text-sm">Tratamientos individuales o masivos por lote.</p>
      </div>
      <Tabs defaultValue="individual">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="individual">Individual</TabsTrigger>
          <TabsTrigger value="masivo">Masivo</TabsTrigger>
        </TabsList>
        <TabsContent value="individual"><Individual estId={activeId!} /></TabsContent>
        <TabsContent value="masivo"><Masivo estId={activeId!} /></TabsContent>
      </Tabs>
      <Recientes estId={activeId!} />
    </div>
  );
}

function Individual({ estId }: { estId: string }) {
  const [form, setForm] = useState({ caravana: "", tipo: "vacuna", producto: "", dosis: "", unidad: "ml", costo: "", fecha: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent) { e.preventDefault(); setSaving(true);
    const { data: a } = await supabase.from("animales").select("id").eq("establecimiento_id", estId).eq("caravana", form.caravana.trim()).maybeSingle();
    if (!a) { setSaving(false); return toast.error("Caravana no encontrada"); }
    const { error } = await supabase.from("sanidad").insert({
      establecimiento_id: estId, animal_id: a.id, tipo: form.tipo as any, producto: form.producto,
      dosis: form.dosis ? Number(form.dosis) : null, unidad: form.unidad, costo: form.costo ? Number(form.costo) : null, fecha: form.fecha,
    });
    setSaving(false); if (error) return toast.error(error.message);
    toast.success("Tratamiento registrado");
    setForm({ ...form, caravana: "" });
  }
  return <Card className="p-6 mt-4"><form onSubmit={submit} className="space-y-3">
    <div><Label>Caravana *</Label><Input autoFocus required value={form.caravana} onChange={(e) => setForm({ ...form, caravana: e.target.value })} className="h-12 text-xl tabular-nums" /></div>
    <div className="grid grid-cols-2 gap-3">
      <div><Label>Tipo *</Label><Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
        <SelectItem value="vacuna">Vacuna</SelectItem><SelectItem value="tratamiento">Tratamiento</SelectItem><SelectItem value="antiparasitario">Antiparasitario</SelectItem><SelectItem value="enfermedad">Enfermedad</SelectItem>
      </SelectContent></Select></div>
      <div><Label>Producto *</Label><Input required value={form.producto} onChange={(e) => setForm({ ...form, producto: e.target.value })} /></div>
    </div>
    <div className="grid grid-cols-3 gap-3">
      <div><Label>Dosis</Label><Input type="number" step="0.01" value={form.dosis} onChange={(e) => setForm({ ...form, dosis: e.target.value })} /></div>
      <div><Label>Unidad</Label><Input value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })} /></div>
      <div><Label>Costo $</Label><Input type="number" step="0.01" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} /></div>
    </div>
    <div><Label>Fecha</Label><Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></div>
    <Button type="submit" disabled={saving} className="w-full h-12">{saving ? "Guardando…" : "Guardar"}</Button>
  </form></Card>;
}

function Masivo({ estId }: { estId: string }) {
  const [tipo, setTipo] = useState("vacuna"); const [producto, setProducto] = useState(""); const [dosis, setDosis] = useState(""); const [costoTotal, setCostoTotal] = useState(""); const [caravanas, setCaravanas] = useState(""); const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10)); const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent) { e.preventDefault(); setSaving(true);
    const list = caravanas.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) { setSaving(false); return toast.error("Cargá al menos una caravana"); }
    const { data: animals } = await supabase.from("animales").select("id, caravana").eq("establecimiento_id", estId).in("caravana", list);
    if (!animals || animals.length === 0) { setSaving(false); return toast.error("No se encontraron animales"); }
    const costoUnit = costoTotal ? Number(costoTotal) / animals.length : null;
    const rows = animals.map((a) => ({ establecimiento_id: estId, animal_id: a.id, tipo: tipo as any, producto, dosis: dosis ? Number(dosis) : null, costo: costoUnit, fecha }));
    const { error } = await supabase.from("sanidad").insert(rows);
    setSaving(false); if (error) return toast.error(error.message);
    toast.success(`${animals.length} registros creados`); setCaravanas("");
  }
  return <Card className="p-6 mt-4"><form onSubmit={submit} className="space-y-3">
    <div className="grid grid-cols-2 gap-3">
      <div><Label>Tipo *</Label><Select value={tipo} onValueChange={setTipo}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
        <SelectItem value="vacuna">Vacuna</SelectItem><SelectItem value="antiparasitario">Antiparasitario</SelectItem><SelectItem value="tratamiento">Tratamiento</SelectItem>
      </SelectContent></Select></div>
      <div><Label>Producto *</Label><Input required value={producto} onChange={(e) => setProducto(e.target.value)} /></div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div><Label>Dosis</Label><Input type="number" step="0.01" value={dosis} onChange={(e) => setDosis(e.target.value)} /></div>
      <div><Label>Costo total $</Label><Input type="number" step="0.01" value={costoTotal} onChange={(e) => setCostoTotal(e.target.value)} /></div>
    </div>
    <div><Label>Caravanas (separadas por coma o espacio) *</Label><Textarea required rows={4} value={caravanas} onChange={(e) => setCaravanas(e.target.value)} placeholder="1245 1267 1289 1290..." className="font-mono text-sm" /></div>
    <div><Label>Fecha</Label><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
    <Button type="submit" disabled={saving} className="w-full h-12">{saving ? "Procesando…" : "Aplicar a todos"}</Button>
  </form></Card>;
}

function Recientes({ estId }: { estId: string }) {
  const [items, setItems] = useState<any[]>([]);
  async function load() {
    const { data } = await supabase.from("sanidad").select("id, fecha, producto, tipo, dosis, costo, animales(caravana)").eq("establecimiento_id", estId).order("fecha", { ascending: false }).limit(300);
    setItems(data ?? []);
  }
  useEffect(() => { load(); }, [estId]);
  async function handleDelete(id: string) {
    const { error } = await supabase.from("sanidad").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Tratamiento eliminado");
    load();
  }
  const cols = [
    { key: "fecha", header: "fecha" },
    { key: "caravana", header: "caravana", get: (s: any) => s.animales?.caravana ?? "" },
    { key: "tipo", header: "tipo" },
    { key: "producto", header: "producto" },
    { key: "dosis", header: "dosis" },
    { key: "costo", header: "costo" },
  ];
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Historial ({items.length})</h2>
        <ExportMenu size="sm" items={items} cols={cols} filename="sanidad" />
      </div>
      <ul className="divide-y divide-border">
        {items.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <span className="font-medium">{s.animales?.caravana} · <span className="font-normal capitalize">{s.tipo}</span></span>
            <span className="text-muted-foreground flex-1 text-right">{fmtDate(s.fecha)} · {s.producto}</span>
            <ConfirmDelete onConfirm={() => handleDelete(s.id)} />
          </li>
        ))}
        {items.length === 0 && <li className="text-muted-foreground text-sm py-2">Sin registros.</li>}
      </ul>
    </Card>
  );
}