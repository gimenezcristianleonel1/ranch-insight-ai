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
import { ExportMenu } from "@/components/data-io";
import { ConfirmDelete } from "@/components/confirm";
import { Upload } from "lucide-react";
import { ImportPreview, type FieldDef, type ColumnMapping, type ImportResult } from "@/components/import-preview";
import { pickFile, parseFile, parsearFechaGanadera } from "@/lib/io";

export const Route = createFileRoute("/_authenticated/movimientos")({
  head: () => ({ meta: [{ title: "Movimientos — Ganadero IA" }] }),
  component: MovsPage,
});

const MOVIMIENTOS_FIELDS: FieldDef[] = [
  {
    key: "caravana", label: "Caravana", esCaravana: true,
    aliases: ["caravana", "nro", "numero", "id", "animal", "tag", "carav"],
    hint: "dejar vacío para movimientos sin animal específico",
  },
  {
    key: "tipo", label: "Tipo", required: true,
    aliases: ["tipo", "tipo movimiento", "movimiento", "evento"],
    hint: "nacimiento / compra / venta / muerte / traslado / cambio_categoria",
    validate: (v) => {
      const valid = ["nacimiento","compra","venta","muerte","traslado","cambio_categoria"];
      if (!v.trim()) return "Tipo vacío";
      const norm = v.trim().toLowerCase().replace(/\s+/g, "_");
      if (!valid.includes(norm) && !valid.some(t => norm.startsWith(t.slice(0,4))))
        return `Tipo inválido: "${v}"`;
      return null;
    },
  },
  {
    key: "fecha", label: "Fecha", esFecha: true,
    aliases: ["fecha", "fecha movimiento", "fecha evento", "date", "f mov"],
  },
  {
    key: "origen", label: "Origen",
    aliases: ["origen", "procedencia", "origen potrero", "potrero origen", "de"],
    hint: "nombre del potrero o establecimiento de origen",
  },
  {
    key: "destino", label: "Destino",
    aliases: ["destino", "destino potrero", "potrero destino", "a", "para"],
    hint: "nombre del potrero o establecimiento destino",
  },
  {
    key: "precio", label: "Precio ($)",
    aliases: ["precio", "valor", "importe", "precio unitario", "precio cabeza"],
    validate: (v) => v && isNaN(Number(v.replace(",","."))) ? `Precio inválido: "${v}"` : null,
  },
  {
    key: "observaciones", label: "Observaciones",
    aliases: ["observaciones", "obs", "notas", "nota", "comentarios", "detalle"],
  },
];

const TIPOS_VALIDOS = ["nacimiento","compra","venta","muerte","traslado","cambio_categoria"] as const;

function normalizarTipoMov(v: string): string {
  const norm = v.trim().toLowerCase().replace(/\s+/g, "_").replace(/\./g, "");
  for (const t of TIPOS_VALIDOS) {
    if (norm === t || norm.startsWith(t.slice(0, 4))) return t;
  }
  return "traslado"; // fallback
}

function MovsPage() {
  const { activeId, active } = useActiveEstablecimiento();
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ caravana: "", tipo: "traslado", origen: "", destino: "", observaciones: "", fecha: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);

  async function load() {
    if (!activeId) return;
    const { data } = await supabase.from("movimientos").select("id, fecha, tipo, origen, destino, animales(caravana)").eq("establecimiento_id", activeId).order("fecha", { ascending: false }).limit(50);
    setItems(data ?? []);
  }
  useEffect(() => { load(); }, [activeId]);

  async function handleDelete(id: string) {
    const { error } = await supabase.from("movimientos").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Movimiento eliminado");
    load();
  }

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
    // Para traslado, intentar resolver potrero_id por nombre
    let potOrigen: string | null = null;
    let potDestino: string | null = null;
    if (form.tipo === "traslado" && (form.origen || form.destino)) {
      const nombres = [form.origen, form.destino].filter(Boolean);
      const { data: pots } = await supabase.from("potreros")
        .select("id, nombre").eq("establecimiento_id", activeId)
        .in("nombre", nombres);
      if (pots) {
        potOrigen = pots.find(p => p.nombre === form.origen)?.id ?? null;
        potDestino = pots.find(p => p.nombre === form.destino)?.id ?? null;
      }
      // Si se resuelve el destino, actualizar potrero_id del animal
      if (animalId && potDestino) {
        await supabase.from("animales").update({ potrero_id: potDestino }).eq("id", animalId);
      }
    }
    const { error } = await supabase.from("movimientos").insert({
      establecimiento_id: activeId, animal_id: animalId, tipo: form.tipo as any,
      origen: form.origen || null, destino: form.destino || null,
      potrero_origen_id: potOrigen, potrero_destino_id: potDestino,
      observaciones: form.observaciones || null, fecha: form.fecha,
    });
    // si es venta o muerte, marcar animal
    if (animalId && (form.tipo === "venta" || form.tipo === "muerte")) {
      await supabase.from("animales").update({ estado: form.tipo === "venta" ? "vendido" : "muerto" }).eq("id", animalId);
    }
    setSaving(false); if (error) return toast.error(error.message);
    toast.success("Movimiento registrado"); setForm({ ...form, caravana: "", observaciones: "" });
    load();
  }

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

    const pick = (row: Record<string, string>, fieldKey: string) => {
      const col = Object.entries(mapping).find(([, v]) => v === fieldKey)?.[0];
      return col ? (row[col] ?? "").trim() : "";
    };

    const fechaDefault = new Date().toISOString().slice(0, 10);
    const errores: ImportResult["errores"] = [];

    // Pre-cargar caravanas para resolver animal_id en lote
    const caravanas = [...new Set(rows.map(r => pick(r, "caravana")).filter(Boolean))];
    const animalMap = new Map<string, string>();
    if (caravanas.length > 0) {
      const { data: animals } = await supabase
        .from("animales").select("id, caravana")
        .eq("establecimiento_id", activeId).in("caravana", caravanas);
      for (const a of animals ?? []) animalMap.set(a.caravana.toLowerCase(), a.id);
    }

    // Pre-cargar potreros para resolver potrero_id por nombre en lote
    const { data: pots } = await supabase
      .from("potreros").select("id, nombre").eq("establecimiento_id", activeId);
    const potreroMap = new Map((pots ?? []).map(p => [p.nombre.toLowerCase(), p.id]));

    // Detectar potreros faltantes en origen/destino
    const origenCol = Object.entries(mapping).find(([, v]) => v === "origen")?.[0];
    const destinoCol = Object.entries(mapping).find(([, v]) => v === "destino")?.[0];
    const nombresEnArchivo = new Set<string>();
    for (const row of rows) {
      if (origenCol && row[origenCol]) nombresEnArchivo.add(row[origenCol].trim());
      if (destinoCol && row[destinoCol]) nombresEnArchivo.add(row[destinoCol].trim());
    }
    const faltantes = [...nombresEnArchivo].filter(n => n && !potreroMap.has(n.toLowerCase()));
    if (faltantes.length > 0) {
      const crear = window.confirm(
        `Los siguientes potreros no existen en el sistema:\n\n` +
        faltantes.map(n => `  • ${n}`).join("\n") +
        `\n\nAceptar = CREAR automáticamente.\nCancelar = Dejar los traslados sin potrero asignado.`
      );
      if (crear) {
        for (const nombre of faltantes) {
          const { data: nuevo } = await supabase.from("potreros")
            .insert({ establecimiento_id: activeId!, nombre, hectareas: 0, estado: "disponible" })
            .select("id, nombre").single();
          if (nuevo) potreroMap.set(nuevo.nombre.toLowerCase(), nuevo.id);
        }
        toast.success(`${faltantes.length} potrero(s) creado(s) automáticamente`);
      }
    }

    const payload: any[] = [];
    const animalesAActualizar: { id: string; tipo: string; destPotId?: string }[] = [];

    rows.forEach((row, idx) => {
      const fila = idx + 2;
      const carRaw = pick(row, "caravana");
      const tipoRaw = pick(row, "tipo");

      if (!tipoRaw) { errores.push({ fila, caravana: carRaw || "", motivo: "Tipo vacío" }); return; }

      const tipo = normalizarTipoMov(tipoRaw);
      const animalId = carRaw ? (animalMap.get(carRaw.toLowerCase()) ?? null) : null;

      // Si hay caravana pero no se encontró, reportar error pero continuar
      if (carRaw && !animalId) {
        errores.push({ fila, caravana: carRaw, motivo: "Caravana no existe en el rodeo" });
        return;
      }

      const origenNombre = pick(row, "origen");
      const destinoNombre = pick(row, "destino");
      const potOrigenId = origenNombre ? (potreroMap.get(origenNombre.toLowerCase()) ?? null) : null;
      const potDestinoId = destinoNombre ? (potreroMap.get(destinoNombre.toLowerCase()) ?? null) : null;
      const fechaRaw = pick(row, "fecha");
      const precioRaw = pick(row, "precio");

      payload.push({
        establecimiento_id: activeId,
        animal_id: animalId,
        tipo,
        fecha: fechaRaw ? (parsearFechaGanadera(fechaRaw) ?? fechaDefault) : fechaDefault,
        origen: origenNombre || null,
        destino: destinoNombre || null,
        potrero_origen_id: potOrigenId,
        potrero_destino_id: potDestinoId,
        observaciones: pick(row, "observaciones") || null,
      });

      // Acumular acciones derivadas sobre el animal
      if (animalId) {
        animalesAActualizar.push({ id: animalId, tipo, destPotId: potDestinoId ?? undefined });
      }
    });

    // Insertar movimientos
    let insertados = 0;
    const BATCH = 500;
    for (let i = 0; i < payload.length; i += BATCH) {
      const { error, count } = await supabase.from("movimientos")
        .insert(payload.slice(i, i + BATCH), { count: "exact" });
      if (error) errores.push({ fila: 0, caravana: "lote", motivo: error.message });
      else insertados += count ?? payload.slice(i, i + BATCH).length;
    }

    // Aplicar efectos secundarios sobre animales (estado, potrero)
    for (const { id, tipo, destPotId } of animalesAActualizar) {
      const updates: Record<string, unknown> = {};
      if (tipo === "venta") updates.estado = "vendido";
      else if (tipo === "muerte") updates.estado = "muerto";
      if (tipo === "traslado" && destPotId) updates.potrero_id = destPotId;
      if (Object.keys(updates).length > 0) {
        await supabase.from("animales").update(updates as never).eq("id", id);
      }
    }

    if (insertados > 0 && errores.filter(e => e.fila !== 0).length === 0)
      toast.success(`${insertados} movimientos importados`);
    else if (insertados > 0)
      toast.warning(`${insertados} importados · ${errores.length} errores`);

    load();
    return { total: rows.length, insertados, actualizados: 0, errores };
  }

  if (!active) return <div className="p-8">Seleccioná un establecimiento.</div>;

  const exportCols = [
    { key: "fecha", header: "fecha" },
    { key: "tipo", header: "tipo" },
    { key: "caravana", header: "caravana", get: (m: any) => m.animales?.caravana ?? "" },
    { key: "origen", header: "origen" },
    { key: "destino", header: "destino" },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div><h1 className="text-3xl font-semibold">Movimientos</h1><p className="text-muted-foreground text-sm">Compras, ventas, traslados y bajas.</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePickFile}>
            <Upload className="h-4 w-4 mr-2" />Importar Excel
          </Button>
          <ExportMenu items={items} cols={exportCols} filename={`movimientos_${active.nombre}`} />
        </div>
      </div>
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
          <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Tipo</TableHead><TableHead>Caravana</TableHead><TableHead>Origen → Destino</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
          <TableBody>
            {items.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{fmtDate(m.fecha)}</TableCell>
                <TableCell className="capitalize">{m.tipo.replace("_", " ")}</TableCell>
                <TableCell>{m.animales?.caravana ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{m.origen ?? "—"} → {m.destino ?? "—"}</TableCell>
                <TableCell className="text-right"><ConfirmDelete onConfirm={() => handleDelete(m.id)} /></TableCell>
              </TableRow>
            ))}
            {items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Sin movimientos</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
      <ImportPreview
        open={previewOpen}
        rows={previewRows}
        fieldDefs={MOVIMIENTOS_FIELDS}
        tipo="animales"
        onConfirm={handleImport}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}