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
import { Scale, Upload } from "lucide-react";
import { ExportMenu } from "@/components/data-io";
import { ConfirmDelete } from "@/components/confirm";
import { ImportPreview, type FieldDef, type ColumnMapping, type ImportResult } from "@/components/import-preview";
import { pickFile, parseFile, parsearFechaGanadera } from "@/lib/io";

export const Route = createFileRoute("/_authenticated/pesadas")({
  head: () => ({ meta: [{ title: "Pesadas — Ganadero IA" }] }),
  component: PesadasPage,
});

// ─── FieldDefs ────────────────────────────────────────────────────────────────

const PESADAS_FIELDS: FieldDef[] = [
  {
    key: "caravana", label: "Caravana", required: true, esCaravana: true,
    aliases: ["caravana", "nro", "numero", "id animal", "tag", "animal", "id", "carav"],
    validate: (v) => !v.trim() ? "Caravana vacía" : null,
  },
  {
    key: "peso", label: "Peso (kg)", required: true,
    aliases: ["peso", "peso kg", "peso (kg)", "kg", "peso vivo", "pv"],
    validate: (v) => !v.trim() ? "Peso vacío" : isNaN(Number(v.replace(",", "."))) ? `Peso inválido: "${v}"` : null,
  },
  {
    key: "fecha", label: "Fecha", esFecha: true,
    aliases: ["fecha", "fecha pesada", "fecha de pesada", "date", "f pesada", "fpesada"],
  },
  {
    key: "observaciones", label: "Observaciones",
    aliases: ["observaciones", "obs", "notas", "nota", "comentarios"],
  },
];

// ─── Página ────────────────────────────────────────────────────────────────────

function PesadasPage() {
  const { activeId, active } = useActiveEstablecimiento();
  const [caravana, setCaravana] = useState("");
  const [peso, setPeso] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [recientes, setRecientes] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Import state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);

  async function load() {
    if (!activeId) return;
    const { data } = await supabase
      .from("pesadas")
      .select("id, peso, fecha, animal_id, animales(caravana), observaciones")
      .eq("establecimiento_id", activeId)
      .order("fecha", { ascending: false })
      .limit(500);
    setRecientes(data ?? []);
  }

  useEffect(() => { load(); }, [activeId]);

  // ── Alta individual ──
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId) return;
    setSaving(true);
    const { data: animal } = await supabase
      .from("animales").select("id")
      .eq("establecimiento_id", activeId).eq("caravana", caravana.trim())
      .maybeSingle();
    if (!animal) { setSaving(false); return toast.error("Caravana no encontrada"); }
    const { error } = await supabase.from("pesadas").insert({
      establecimiento_id: activeId, animal_id: animal.id,
      peso: Number(peso), fecha,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`${caravana} → ${peso} kg`);
    setCaravana(""); setPeso("");
    load();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("pesadas").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Pesada eliminada");
    load();
  }

  // ── Importación con preview ──
  async function handlePickFile() {
    const file = await pickFile();
    if (!file) return;
    const rows = await parseFile(file);
    if (!rows.length) { toast.error("El archivo está vacío"); return; }
    setPreviewRows(rows);
    setPreviewOpen(true);
  }

  async function handleImport(
    mapping: ColumnMapping,
    rows: Record<string, string>[]
  ): Promise<ImportResult> {
    if (!activeId) return { total: 0, insertados: 0, actualizados: 0, errores: [] };

    const pick = (row: Record<string, string>, fieldKey: string): string => {
      const col = Object.entries(mapping).find(([, v]) => v === fieldKey)?.[0];
      return col ? (row[col] ?? "").trim() : "";
    };

    const fechaDefault = new Date().toISOString().slice(0, 10);
    const errores: ImportResult["errores"] = [];
    const payload: any[] = [];

    // Resolver caravanas en lote
    const caravanas = rows.map(r => pick(r, "caravana")).filter(Boolean);
    const { data: animals } = await supabase
      .from("animales").select("id, caravana")
      .eq("establecimiento_id", activeId).in("caravana", [...new Set(caravanas)]);
    const animalMap = new Map((animals ?? []).map(a => [a.caravana.toLowerCase(), a.id]));

    rows.forEach((row, idx) => {
      const fila = idx + 2;
      const carRaw = pick(row, "caravana");
      const pesoRaw = pick(row, "peso");
      const fechaRaw = pick(row, "fecha");
      const obs = pick(row, "observaciones");

      if (!carRaw) { errores.push({ fila, caravana: "", motivo: "Caravana vacía" }); return; }
      if (!pesoRaw) { errores.push({ fila, caravana: carRaw, motivo: "Peso vacío" }); return; }

      const animalId = animalMap.get(carRaw.toLowerCase());
      if (!animalId) {
        errores.push({ fila, caravana: carRaw, motivo: "Caravana no existe en el rodeo" });
        return;
      }

      const pesoNum = Number(pesoRaw.replace(",", "."));
      if (isNaN(pesoNum) || pesoNum <= 0) {
        errores.push({ fila, caravana: carRaw, motivo: `Peso inválido: "${pesoRaw}"` });
        return;
      }

      const fechaISO = fechaRaw ? (parsearFechaGanadera(fechaRaw) ?? fechaDefault) : fechaDefault;

      payload.push({
        establecimiento_id: activeId,
        animal_id: animalId,
        peso: pesoNum,
        fecha: fechaISO,
        observaciones: obs || null,
      });
    });

    let insertados = 0;
    const BATCH = 500;
    for (let i = 0; i < payload.length; i += BATCH) {
      const { error, count } = await supabase.from("pesadas")
        .insert(payload.slice(i, i + BATCH), { count: "exact" });
      if (error) errores.push({ fila: 0, caravana: "lote", motivo: error.message });
      else insertados += count ?? payload.slice(i, i + BATCH).length;
    }

    if (errores.filter(e => e.fila !== 0).length === 0 && insertados > 0) {
      toast.success(`${insertados} pesadas importadas`);
    } else if (insertados > 0) {
      toast.warning(`${insertados} importadas · ${errores.length} errores`);
    }

    load();
    return { total: rows.length, insertados, actualizados: 0, errores };
  }

  if (!active) return <div className="p-8">Seleccioná un establecimiento.</div>;

  const exportCols = [
    { key: "caravana", header: "caravana", get: (r: any) => r.animales?.caravana ?? "" },
    { key: "peso", header: "peso" },
    { key: "fecha", header: "fecha" },
    { key: "observaciones", header: "observaciones" },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Pesadas</h1>
          <p className="text-muted-foreground text-sm">Carga rápida — caravana, peso, listo.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handlePickFile}>
            <Upload className="h-4 w-4 mr-2" />Importar Excel
          </Button>
          <ExportMenu items={recientes} cols={exportCols} filename={`pesadas_${active.nombre}`} />
        </div>
      </div>

      {/* Alta individual */}
      <Card className="p-6 max-w-2xl">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-base">Caravana</Label>
              <Input autoFocus required value={caravana}
                onChange={e => setCaravana(e.target.value)}
                className="h-14 text-2xl tabular-nums font-mono" />
            </div>
            <div>
              <Label className="text-base">Peso (kg)</Label>
              <Input required type="number" step="0.1" value={peso}
                onChange={e => setPeso(e.target.value)}
                className="h-14 text-2xl tabular-nums" />
            </div>
            <div>
              <Label className="text-base">Fecha</Label>
              <Input type="date" value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="h-14" />
            </div>
          </div>
          <Button type="submit" disabled={saving} className="w-full h-14 text-lg">
            {saving ? "Guardando…" : "Guardar pesada"}
          </Button>
        </form>
      </Card>

      {/* Historial */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <Scale className="h-4 w-4" />Historial ({recientes.length})
          </h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Caravana</TableHead>
              <TableHead className="text-right">Peso (kg)</TableHead>
              <TableHead>Observaciones</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {recientes.map(r => (
              <TableRow key={r.id}>
                <TableCell>{fmtDate(r.fecha)}</TableCell>
                <TableCell className="font-mono font-medium">{r.animales?.caravana ?? "?"}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{fmtNum(r.peso, 1)}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{r.observaciones ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <ConfirmDelete onConfirm={() => handleDelete(r.id)} />
                </TableCell>
              </TableRow>
            ))}
            {recientes.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Sin pesadas registradas
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Importador inteligente */}
      <ImportPreview
        open={previewOpen}
        rows={previewRows}
        fieldDefs={PESADAS_FIELDS}
        tipo="pesadas"
        onConfirm={handleImport}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}
