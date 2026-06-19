import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEstablecimiento } from "@/hooks/use-establecimiento";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Sprout, TrendingDown, TrendingUp } from "lucide-react";
import { fmtNum } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/forrajes")({
  head: () => ({ meta: [{ title: "Forrajes y balance — Ganadero IA" }] }),
  component: ForrajesPage,
});

type Potrero = { id: string; nombre: string; hectareas: number };
type Aforo = { id: string; fecha: string; potrero_id: string | null; kg_ms_ha: number; altura_cm: number | null; metodo: string | null };

function ForrajesPage() {
  const { activeId } = useActiveEstablecimiento();
  const [potreros, setPotreros] = useState<Potrero[]>([]);
  const [aforos, setAforos] = useState<Aforo[]>([]);
  const [evTotal, setEvTotal] = useState(0);
  const [form, setForm] = useState({ potrero_id: "", kg_ms_ha: "", altura_cm: "", metodo: "doble_muestreo" });

  async function load() {
    if (!activeId) return;
    const [{ data: p }, { data: a }, { data: an }] = await Promise.all([
      supabase.from("potreros").select("id,nombre,hectareas").eq("establecimiento_id", activeId).order("nombre"),
      supabase.from("aforos").select("*").eq("establecimiento_id", activeId).order("fecha", { ascending: false }).limit(50),
      supabase.from("animales").select("ev").eq("establecimiento_id", activeId).eq("estado", "activo"),
    ]);
    setPotreros((p as Potrero[]) ?? []);
    setAforos((a as Aforo[]) ?? []);
    setEvTotal((an ?? []).reduce((s: number, r: { ev: number | null }) => s + (Number(r.ev) || 1), 0));
  }
  useEffect(() => { load(); }, [activeId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId || !form.potrero_id) return toast.error("Seleccioná potrero");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("aforos").insert({
      establecimiento_id: activeId,
      potrero_id: form.potrero_id,
      kg_ms_ha: Number(form.kg_ms_ha),
      altura_cm: form.altura_cm ? Number(form.altura_cm) : null,
      metodo: form.metodo,
      user_id: u.user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Aforo registrado");
    setForm({ potrero_id: "", kg_ms_ha: "", altura_cm: "", metodo: "doble_muestreo" });
    load();
  }

  // Balance forrajero simple: por potrero, último aforo * ha. EV consume ~12 kg MS/día.
  const filas = potreros.map((p) => {
    const ult = aforos.find((a) => a.potrero_id === p.id);
    const kgMs = ult ? Number(ult.kg_ms_ha) * Number(p.hectareas || 0) : 0;
    const diasOferta = kgMs > 0 && evTotal > 0 ? kgMs / (evTotal * 12) : 0;
    return { p, ult, kgMs, diasOferta };
  });
  const totalKgMs = filas.reduce((s, f) => s + f.kgMs, 0);
  const diasTotales = evTotal > 0 ? totalKgMs / (evTotal * 12) : 0;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Forrajes y balance</h1>
        <p className="text-muted-foreground text-sm">Aforos por potrero y oferta forrajera para la carga animal actual.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4"><div className="text-xs text-muted-foreground">EV en stock</div><div className="text-2xl font-bold mt-1">{fmtNum(evTotal, 1)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">MS disponible (kg)</div><div className="text-2xl font-bold mt-1">{fmtNum(totalKgMs, 0)}</div></Card>
        <Card className="p-4 flex items-center justify-between">
          <div><div className="text-xs text-muted-foreground">Días de oferta</div><div className="text-2xl font-bold mt-1">{fmtNum(diasTotales, 0)}</div></div>
          {diasTotales < 30 ? <TrendingDown className="h-8 w-8 text-destructive" /> : <TrendingUp className="h-8 w-8 text-primary" />}
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><Sprout className="h-4 w-4 text-primary" /> Nuevo aforo</h2>
        <form onSubmit={save} className="grid md:grid-cols-5 gap-3 items-end">
          <div className="md:col-span-2">
            <Label>Potrero</Label>
            <Select value={form.potrero_id} onValueChange={(v) => setForm({ ...form, potrero_id: v })}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>{potreros.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>kg MS/ha</Label><Input type="number" required value={form.kg_ms_ha} onChange={(e) => setForm({ ...form, kg_ms_ha: e.target.value })} /></div>
          <div><Label>Altura (cm)</Label><Input type="number" value={form.altura_cm} onChange={(e) => setForm({ ...form, altura_cm: e.target.value })} /></div>
          <Button type="submit">Guardar</Button>
        </form>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Balance por potrero</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground border-b border-border"><th className="py-2">Potrero</th><th>Ha</th><th>kg MS/ha</th><th>MS total</th><th>Días</th></tr></thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.p.id} className="border-b border-border/50">
                  <td className="py-2 font-medium">{f.p.nombre}</td>
                  <td>{fmtNum(f.p.hectareas, 1)}</td>
                  <td>{f.ult ? fmtNum(f.ult.kg_ms_ha, 0) : "—"}</td>
                  <td>{fmtNum(f.kgMs, 0)}</td>
                  <td className={f.diasOferta < 20 && f.kgMs > 0 ? "text-destructive font-medium" : ""}>{f.kgMs > 0 ? fmtNum(f.diasOferta, 0) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}