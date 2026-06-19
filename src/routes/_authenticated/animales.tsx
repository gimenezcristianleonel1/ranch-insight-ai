import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEstablecimiento } from "@/hooks/use-establecimiento";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { fmtNum, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/animales")({
  head: () => ({ meta: [{ title: "Animales — Ganadero IA" }] }),
  component: AnimalesPage,
});

type Animal = {
  id: string;
  caravana: string;
  rfid: string | null;
  sexo: "macho" | "hembra";
  fecha_nacimiento: string | null;
  peso_actual: number | null;
  estado: string;
  estado_reproductivo: string | null;
  raza_id: string | null;
  categoria_id: string | null;
};

function AnimalesPage() {
  const { activeId, active } = useActiveEstablecimiento();
  const [items, setItems] = useState<Animal[]>([]);
  const [razas, setRazas] = useState<{ id: string; nombre: string }[]>([]);
  const [cats, setCats] = useState<{ id: string; nombre: string }[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    caravana: "", rfid: "", sexo: "hembra", fecha_nacimiento: "", peso_actual: "",
    raza_id: "", categoria_id: "", estado_reproductivo: "",
  });

  async function load() {
    if (!activeId) return;
    const { data } = await supabase.from("animales")
      .select("id, caravana, rfid, sexo, fecha_nacimiento, peso_actual, estado, estado_reproductivo, raza_id, categoria_id")
      .eq("establecimiento_id", activeId)
      .order("caravana");
    setItems((data as Animal[]) ?? []);
  }
  useEffect(() => {
    if (!activeId) return;
    load();
    supabase.from("razas").select("id, nombre").order("nombre").then(({ data }) => setRazas(data ?? []));
    supabase.from("categorias").select("id, nombre").order("orden").then(({ data }) => setCats(data ?? []));
  }, [activeId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId) return;
    setSaving(true);
    const { error } = await supabase.from("animales").insert({
      establecimiento_id: activeId,
      caravana: form.caravana.trim(),
      rfid: form.rfid || null,
      sexo: form.sexo as "macho" | "hembra",
      fecha_nacimiento: form.fecha_nacimiento || null,
      peso_actual: form.peso_actual ? Number(form.peso_actual) : null,
      raza_id: form.raza_id || null,
      categoria_id: form.categoria_id || null,
      estado_reproductivo: form.estado_reproductivo || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Animal creado");
    setOpen(false);
    setForm({ caravana: "", rfid: "", sexo: "hembra", fecha_nacimiento: "", peso_actual: "", raza_id: "", categoria_id: "", estado_reproductivo: "" });
    load();
  }

  if (!active) return <div className="p-8">Seleccioná un establecimiento.</div>;

  const catMap = new Map(cats.map((c) => [c.id, c.nombre]));
  const razaMap = new Map(razas.map((r) => [r.id, r.nombre]));
  const filtered = items.filter((a) => !q || a.caravana.toLowerCase().includes(q.toLowerCase()) || a.rfid?.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Animales</h1>
          <p className="text-muted-foreground text-sm">{items.length} animales en {active.nombre}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nuevo animal</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Nuevo animal</DialogTitle></DialogHeader>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Caravana *</Label><Input required value={form.caravana} onChange={(e) => setForm({ ...form, caravana: e.target.value })} /></div>
                <div><Label>RFID</Label><Input value={form.rfid} onChange={(e) => setForm({ ...form, rfid: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Sexo *</Label>
                  <Select value={form.sexo} onValueChange={(v) => setForm({ ...form, sexo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="hembra">Hembra</SelectItem><SelectItem value="macho">Macho</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Categoría</Label>
                  <Select value={form.categoria_id} onValueChange={(v) => setForm({ ...form, categoria_id: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Raza</Label>
                  <Select value={form.raza_id} onValueChange={(v) => setForm({ ...form, raza_id: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{razas.map((r) => <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Fecha nacimiento</Label><Input type="date" value={form.fecha_nacimiento} onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })} /></div>
                <div><Label>Peso actual (kg)</Label><Input type="number" step="0.1" value={form.peso_actual} onChange={(e) => setForm({ ...form, peso_actual: e.target.value })} /></div>
              </div>
              <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Crear"}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4">
        <div className="relative max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
          <Input placeholder="Buscar por caravana o RFID…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Caravana</TableHead>
              <TableHead>Sexo</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Raza</TableHead>
              <TableHead>Nacimiento</TableHead>
              <TableHead className="text-right">Peso (kg)</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((a) => (
              <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell className="font-medium"><Link to="/animales/$id" params={{ id: a.id }}>{a.caravana}</Link></TableCell>
                <TableCell>{a.sexo === "hembra" ? "♀" : "♂"}</TableCell>
                <TableCell>{catMap.get(a.categoria_id ?? "") ?? "—"}</TableCell>
                <TableCell>{razaMap.get(a.raza_id ?? "") ?? "—"}</TableCell>
                <TableCell>{fmtDate(a.fecha_nacimiento)}</TableCell>
                <TableCell className="text-right tabular-nums">{a.peso_actual ? fmtNum(a.peso_actual) : "—"}</TableCell>
                <TableCell><Badge variant={a.estado === "activo" ? "default" : "secondary"}>{a.estado}</Badge></TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No hay animales que mostrar</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}