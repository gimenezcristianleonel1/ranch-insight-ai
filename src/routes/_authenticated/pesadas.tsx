import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEstablecimiento } from "@/hooks/use-establecimiento";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { fmtDate, fmtNum } from "@/lib/format";
import { Scale } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pesadas")({
  head: () => ({ meta: [{ title: "Pesadas — Ganadero IA" }] }),
  component: PesadasPage,
});

function PesadasPage() {
  const { activeId, active } = useActiveEstablecimiento();
  const [caravana, setCaravana] = useState("");
  const [peso, setPeso] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [recientes, setRecientes] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!activeId) return;
    const { data } = await supabase
      .from("pesadas")
      .select("id, peso, fecha, animales(caravana)")
      .eq("establecimiento_id", activeId)
      .order("created_at", { ascending: false })
      .limit(15);
    setRecientes(data ?? []);
  }
  useEffect(() => { load(); }, [activeId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId) return;
    setSaving(true);
    const { data: animal, error: errA } = await supabase
      .from("animales").select("id").eq("establecimiento_id", activeId).eq("caravana", caravana.trim()).maybeSingle();
    if (errA || !animal) { setSaving(false); return toast.error("Caravana no encontrada"); }
    const { error } = await supabase.from("pesadas").insert({
      establecimiento_id: activeId, animal_id: animal.id, peso: Number(peso), fecha,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Pesada registrada: ${caravana} → ${peso} kg`);
    setCaravana(""); setPeso("");
    load();
  }

  if (!active) return <div className="p-8">Seleccioná un establecimiento.</div>;

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Pesadas</h1>
        <p className="text-muted-foreground text-sm">Carga rápida — caravana, peso, listo.</p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label className="text-base">Caravana</Label><Input autoFocus required value={caravana} onChange={(e) => setCaravana(e.target.value)} className="h-14 text-2xl tabular-nums" /></div>
            <div><Label className="text-base">Peso (kg)</Label><Input required type="number" step="0.1" value={peso} onChange={(e) => setPeso(e.target.value)} className="h-14 text-2xl tabular-nums" /></div>
            <div><Label className="text-base">Fecha</Label><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-14" /></div>
          </div>
          <Button type="submit" disabled={saving} className="w-full h-14 text-lg">{saving ? "Guardando…" : "Guardar pesada"}</Button>
        </form>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><Scale className="h-4 w-4" /> Últimas 15</h2>
        <ul className="divide-y divide-border">
          {recientes.map((r) => (
            <li key={r.id} className="flex justify-between py-2 text-sm">
              <span>{r.animales?.caravana ?? "?"} · {fmtDate(r.fecha)}</span>
              <span className="font-medium tabular-nums">{fmtNum(r.peso)} kg</span>
            </li>
          ))}
          {recientes.length === 0 && <li className="text-muted-foreground text-sm py-2">Sin pesadas aún.</li>}
        </ul>
      </Card>
    </div>
  );
}