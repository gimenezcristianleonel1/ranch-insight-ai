import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEstablecimiento } from "@/hooks/use-establecimiento";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/movimientos")({
  head: () => ({ meta: [{ title: "Movimientos — Ganadero IA" }] }),
  component: MovsPage,
});

function MovsPage() {
  const { activeId, active } = useActiveEstablecimiento();
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ caravana: "", tipo: "traslado", origen: "", destino: "", observaciones: "", fecha: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!activeId) return;
    const { data } = await supabase.from("movimientos").select("id, fecha, tipo, origen, destino, animales(caravana)").eq("establecimiento_id", activeId).order("fecha", { ascending: false }).limit(50);
    setItems(data ?? []);
  }
  useEffect(() => { load(); }, [activeId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId) return;
    setSaving(true);
    let animalId: string | null = null;
    if (form.caravana) {
      const { data } = await supabase.from("animales").select("id").eq("establecimiento_id", activeId).eq("caravana", form.caravana.trim()).maybeSingle();
      if (!data) { setSaving(false); return toast.error("Caravana no encontrada"); }
      animalId = data.id;
    }
    const { error } = await supabase.from("movimientos").insert({
      establecimiento_id: activeId, animal_id: animalId, tipo: form.tipo as any,
      origen: form.origen || null, destino: form.destino || null, observaciones: form.observaciones || null, fecha: form.fecha,
    });
    // si es venta o muerte, marcar animal
    if (animalId && (form.tipo === "venta" || form.tipo === "muerte")) {
      await supabase.from("animales").update({ estado: form.tipo === "venta" ? "vendido" : "muerto" }).eq("id", animalId);
    }
    setSaving(false); if (error) return toast.error(error.message);
    toast.success("Movimiento registrado"); setForm({ ...form, caravana: "", observaciones: "" });
    load();
  }

  if (!active) return <div className="p-8">Seleccioná un establecimiento.</div>;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div><h1 className="text-3xl font-semibold">Movimientos</h1><p className="text-muted-foreground text-sm">Compras, ventas, traslados y bajas.</p></div>
      <Card className="p-6"><form onSubmit={submit} className="grid md:grid-cols-3 gap-3">
        <div><Label>Caravana</Label><Input value={form.caravana} onChange={(e) => setForm({ ...form, caravana: e.target.value })} placeholder="opcional para movimientos masivos" /></div>
        <div><Label>Tipo *</Label><Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value="nacimiento">Nacimiento</SelectItem><SelectItem value="compra">Compra</SelectItem><SelectItem value="venta">Venta</SelectItem><SelectItem value="muerte">Muerte</SelectItem><SelectItem value="traslado">Traslado</SelectItem><SelectItem value="cambio_categoria">Cambio categoría</SelectItem>
        </SelectContent></Select></div>
        <div><Label>Fecha</Label><Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></div>
        <div><Label>Origen</Label><Input value={form.origen} onChange={(e) => setForm({ ...form, origen: e.target.value })} /></div>
        <div><Label>Destino</Label><Input value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value })} /></div>
        <div className="md:col-span-3"><Label>Observaciones</Label><Input value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></div>
        <div className="md:col-span-3"><Button type="submit" disabled={saving} className="w-full md:w-auto h-12 px-8">{saving ? "Guardando…" : "Registrar movimiento"}</Button></div>
      </form></Card>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Tipo</TableHead><TableHead>Caravana</TableHead><TableHead>Origen → Destino</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map((m) => (
              <TableRow key={m.id}><TableCell>{fmtDate(m.fecha)}</TableCell><TableCell className="capitalize">{m.tipo.replace("_", " ")}</TableCell><TableCell>{m.animales?.caravana ?? "—"}</TableCell><TableCell className="text-muted-foreground">{m.origen ?? "—"} → {m.destino ?? "—"}</TableCell></TableRow>
            ))}
            {items.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Sin movimientos</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}