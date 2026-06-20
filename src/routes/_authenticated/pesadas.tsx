import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEstablecimiento } from "@/hooks/use-establecimiento";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { fmtDate, fmtNum } from "@/lib/format";
import { Scale } from "lucide-react";
import { ExportMenu, ImportButton } from "@/components/data-io";
import { ConfirmDelete } from "@/components/confirm";

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
      .select("id, peso, fecha, animal_id, animales(caravana)")
      .eq("establecimiento_id", activeId)
      .order("fecha", { ascending: false })
      .limit(500);
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

  async function handleDelete(id: string) {
    const { error } = await supabase.from("pesadas").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Pesada eliminada");
    load();
  }

  async function handleImport(rows: Record<string, unknown>[]) {
    if (!activeId) return;
    const pick = (r: Record<string, unknown>, ...keys: string[]) => {
      for (const k of keys) {
        const f = Object.keys(r).find((x) => x.trim().toLowerCase() === k.toLowerCase());
        if (f && r[f] !== "" && r[f] != null) return String(r[f]).trim();
      }
      return "";
    };
    const list = rows.map((r) => ({
      caravana: pick(r, "caravana", "Caravana"),
      peso: pick(r, "peso", "Peso", "peso (kg)", "Peso (kg)"),
      fecha: pick(r, "fecha", "Fecha") || new Date().toISOString().slice(0, 10),
    })).filter((x) => x.caravana && x.peso);
    if (list.length === 0) { toast.error("Faltan columnas 'caravana' y 'peso'"); return; }
    const caravanas = [...new Set(list.map((x) => x.caravana))];
    const { data: animals } = await supabase.from("animales").select("id, caravana")
      .eq("establecimiento_id", activeId).in("caravana", caravanas);
    const m = new Map((animals ?? []).map((a) => [a.caravana, a.id]));
    const payload = list.flatMap((x) => {
      const id = m.get(x.caravana);
      if (!id) return [];
      return [{
        establecimiento_id: activeId,
        animal_id: id,
        peso: Number(x.peso.replace(",", ".")),
        fecha: /^\d{4}-\d{2}-\d{2}$/.test(x.fecha) ? x.fecha : new Date(x.fecha).toISOString().slice(0, 10),
      }];
    });
    if (payload.length === 0) { toast.error("Ninguna caravana coincide con el rodeo"); return; }
    const { error } = await supabase.from("pesadas").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(`${payload.length} pesadas importadas`);
    load();
  }

  if (!active) return <div className="p-8">Seleccioná un establecimiento.</div>;

  const exportCols = [
    { key: "caravana", header: "caravana", get: (r: any) => r.animales?.caravana ?? "" },
    { key: "peso", header: "peso" },
    { key: "fecha", header: "fecha" },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Pesadas</h1>
          <p className="text-muted-foreground text-sm">Carga rápida — caravana, peso, listo.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ImportButton onRows={handleImport} />
          <ExportMenu items={recientes} cols={exportCols} filename={`pesadas_${active.nombre}`} />
        </div>
      </div>

      <Card className="p-6 max-w-2xl">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label className="text-base">Caravana</Label><Input autoFocus required value={caravana} onChange={(e) => setCaravana(e.target.value)} className="h-14 text-2xl tabular-nums" /></div>
            <div><Label className="text-base">Peso (kg)</Label><Input required type="number" step="0.1" value={peso} onChange={(e) => setPeso(e.target.value)} className="h-14 text-2xl tabular-nums" /></div>
            <div><Label className="text-base">Fecha</Label><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-14" /></div>
          </div>
          <Button type="submit" disabled={saving} className="w-full h-14 text-lg">{saving ? "Guardando…" : "Guardar pesada"}</Button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold flex items-center gap-2"><Scale className="h-4 w-4" /> Historial ({recientes.length})</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Caravana</TableHead>
              <TableHead className="text-right">Peso (kg)</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {recientes.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{fmtDate(r.fecha)}</TableCell>
                <TableCell className="font-medium">{r.animales?.caravana ?? "?"}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtNum(r.peso)}</TableCell>
                <TableCell className="text-right">
                  <ConfirmDelete onConfirm={() => handleDelete(r.id)} />
                </TableCell>
              </TableRow>
            ))}
            {recientes.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Sin pesadas</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}