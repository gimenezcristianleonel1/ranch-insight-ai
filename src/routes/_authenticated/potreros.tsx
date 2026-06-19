import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEstablecimiento } from "@/hooks/use-establecimiento";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, MapPinned, Droplets } from "lucide-react";
import { fmtNum } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/potreros")({
  head: () => ({ meta: [{ title: "Potreros — Ganadero IA" }] }),
  component: PotrerosPage,
});

type Potrero = {
  id: string;
  nombre: string;
  hectareas: number;
  tipo_suelo: string | null;
  tipo_pastura: string | null;
  aguadas: number;
  estado: string;
};

function PotrerosPage() {
  const { activeId, active } = useActiveEstablecimiento();
  const [items, setItems] = useState<Potrero[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nombre: "", hectareas: "", tipo_suelo: "", tipo_pastura: "", aguadas: "0" });
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!activeId) return;
    const { data } = await supabase.from("potreros").select("*").eq("establecimiento_id", activeId).order("nombre");
    setItems((data as Potrero[]) ?? []);
  }
  useEffect(() => { load(); }, [activeId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId) return;
    setSaving(true);
    const { error } = await supabase.from("potreros").insert({
      establecimiento_id: activeId,
      nombre: form.nombre,
      hectareas: Number(form.hectareas || 0),
      tipo_suelo: form.tipo_suelo || null,
      tipo_pastura: form.tipo_pastura || null,
      aguadas: Number(form.aguadas || 0),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Potrero creado");
    setOpen(false);
    setForm({ nombre: "", hectareas: "", tipo_suelo: "", tipo_pastura: "", aguadas: "0" });
    load();
  }

  if (!active) return <div className="p-8">Seleccioná un establecimiento.</div>;

  const totalHa = items.reduce((s, p) => s + Number(p.hectareas), 0);

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Potreros</h1>
          <p className="text-muted-foreground text-sm">{items.length} potreros · {fmtNum(totalHa)} ha totales</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nuevo potrero</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo potrero</DialogTitle></DialogHeader>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nombre *</Label><Input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
                <div><Label>Hectáreas *</Label><Input type="number" step="0.01" required value={form.hectareas} onChange={(e) => setForm({ ...form, hectareas: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Tipo de suelo</Label><Input value={form.tipo_suelo} onChange={(e) => setForm({ ...form, tipo_suelo: e.target.value })} /></div>
                <div><Label>Tipo de pastura</Label><Input value={form.tipo_pastura} onChange={(e) => setForm({ ...form, tipo_pastura: e.target.value })} placeholder="Gatton, Grama Rhodes…" /></div>
              </div>
              <div><Label>Aguadas</Label><Input type="number" value={form.aguadas} onChange={(e) => setForm({ ...form, aguadas: e.target.value })} /></div>
              <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Crear"}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <Card className="p-12 text-center">
          <MapPinned className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Aún no hay potreros cargados.</p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{p.nombre}</h3>
                  <p className="text-2xl font-semibold mt-1 text-primary">{fmtNum(p.hectareas)} ha</p>
                  <p className="text-xs text-muted-foreground mt-2">{p.tipo_pastura ?? p.tipo_suelo ?? "—"}</p>
                </div>
                <div className="flex items-center text-xs text-muted-foreground gap-1">
                  <Droplets className="h-3 w-3" /> {p.aguadas}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}