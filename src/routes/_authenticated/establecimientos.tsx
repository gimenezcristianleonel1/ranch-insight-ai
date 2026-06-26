import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEstablecimientos, useActiveEstablecimiento } from "@/hooks/use-establecimiento";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Building2, Pencil, MapPin, Ruler } from "lucide-react";
import { fmtNum } from "@/lib/format";
import { ConfirmDelete } from "@/components/confirm";

export const Route = createFileRoute("/_authenticated/establecimientos")({
  head: () => ({ meta: [{ title: "Establecimientos — Ganadero IA" }] }),
  component: EstablecimientosPage,
});

type EstForm = {
  nombre: string; propietario: string; provincia: string; localidad: string;
  superficie_total: string; superficie_ganadera: string;
};

const emptyForm: EstForm = {
  nombre: "", propietario: "", provincia: "", localidad: "",
  superficie_total: "", superficie_ganadera: "",
};

function EstablecimientosPage() {
  const { data, loading, refresh } = useEstablecimientos();
  const { setActiveId } = useActiveEstablecimiento();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<EstForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      nombre: form.nombre,
      propietario: form.propietario || null,
      provincia: form.provincia || null,
      localidad: form.localidad || null,
      superficie_total: form.superficie_total ? Number(form.superficie_total) : null,
      superficie_ganadera: form.superficie_ganadera ? Number(form.superficie_ganadera) : null,
    };
    if (editing) {
      const { error } = await supabase.from("establecimientos").update(payload).eq("id", editing);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Establecimiento actualizado");
    } else {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) { setSaving(false); return; }
      const { data: newEst, error } = await supabase
        .from("establecimientos")
        .insert({ ...payload, owner_id: user.user.id })
        .select("id")
        .single();
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Establecimiento creado");
      if (newEst?.id) setActiveId(newEst.id);
    }
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
    refresh();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("establecimientos").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Establecimiento eliminado");
    refresh();
  }

  function openEdit(est: typeof data[number]) {
    setEditing(est.id);
    setForm({
      nombre: est.nombre,
      propietario: (est as any).propietario ?? "",
      provincia: (est as any).provincia ?? "",
      localidad: (est as any).localidad ?? "",
      superficie_total: (est as any).superficie_total?.toString() ?? "",
      superficie_ganadera: est.superficie_ganadera?.toString() ?? "",
    });
    setOpen(true);
  }

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  const FormDialog = (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(emptyForm); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar establecimiento" : "Nuevo establecimiento"}</DialogTitle>
        </DialogHeader>
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
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Establecimientos</h1>
          <p className="text-muted-foreground text-sm">Tus campos. Cada uno tiene su propio rodeo, potreros e indicadores.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nuevo</Button>
      </div>

      {FormDialog}

      {loading ? <div>Cargando…</div> : data.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Aún no creaste ningún establecimiento.</p>
          <Button className="mt-4" onClick={openNew}><Plus className="h-4 w-4 mr-2" />Crear primer campo</Button>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {data.map((est) => (
            <Card key={est.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <h3 className="font-semibold text-lg truncate">{est.nombre}</h3>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                    {(est as any).provincia && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {(est as any).provincia}{(est as any).localidad ? `, ${(est as any).localidad}` : ""}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Ruler className="h-3 w-3" />
                      {fmtNum(est.superficie_ganadera ?? 0)} ha ganaderas
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 ml-3 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(est)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <ConfirmDelete
                    title={`¿Eliminar "${est.nombre}"?`}
                    description="Se eliminará el establecimiento y todos sus datos (animales, potreros, movimientos, etc.). Esta acción no se puede deshacer."
                    onConfirm={() => handleDelete(est.id)}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
