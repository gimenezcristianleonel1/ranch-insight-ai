import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEstablecimientos } from "@/hooks/use-establecimiento";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Building2 } from "lucide-react";
import { fmtNum } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/establecimientos")({
  head: () => ({ meta: [{ title: "Establecimientos — Ganadero IA" }] }),
  component: EstablecimientosPage,
});

function EstablecimientosPage() {
  const { data, loading, refresh } = useEstablecimientos();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nombre: "", propietario: "", provincia: "", localidad: "", superficie_total: "", superficie_ganadera: "" });
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { error } = await supabase.from("establecimientos").insert({
      owner_id: user.user.id,
      nombre: form.nombre,
      propietario: form.propietario || null,
      provincia: form.provincia || null,
      localidad: form.localidad || null,
      superficie_total: form.superficie_total ? Number(form.superficie_total) : null,
      superficie_ganadera: form.superficie_ganadera ? Number(form.superficie_ganadera) : null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Establecimiento creado");
    setOpen(false);
    setForm({ nombre: "", propietario: "", provincia: "", localidad: "", superficie_total: "", superficie_ganadera: "" });
    refresh();
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Establecimientos</h1>
          <p className="text-muted-foreground text-sm">Tus campos. Cada uno tiene su propio rodeo, potreros e indicadores.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nuevo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo establecimiento</DialogTitle></DialogHeader>
            <form onSubmit={handleSave} className="space-y-3">
              <div><Label>Nombre *</Label><Input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Propietario</Label><Input value={form.propietario} onChange={(e) => setForm({ ...form, propietario: e.target.value })} /></div>
                <div><Label>Provincia</Label><Input value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} /></div>
              </div>
              <div><Label>Localidad</Label><Input value={form.localidad} onChange={(e) => setForm({ ...form, localidad: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Superficie total (ha)</Label><Input type="number" step="0.01" value={form.superficie_total} onChange={(e) => setForm({ ...form, superficie_total: e.target.value })} /></div>
                <div><Label>Superficie ganadera (ha)</Label><Input type="number" step="0.01" value={form.superficie_ganadera} onChange={(e) => setForm({ ...form, superficie_ganadera: e.target.value })} /></div>
              </div>
              <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Crear"}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? <div>Cargando…</div> : data.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Aún no creaste ningún establecimiento.</p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {data.map((e) => (
            <Card key={e.id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{e.nombre}</h3>
                  <p className="text-sm text-muted-foreground">{fmtNum(e.superficie_ganadera ?? 0)} ha ganaderas</p>
                </div>
                <Building2 className="h-5 w-5 text-muted-foreground" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}