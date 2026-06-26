import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEstablecimiento } from "@/hooks/use-establecimiento";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Pencil } from "lucide-react";
import { fmtNum, fmtDate } from "@/lib/format";
import { ExportMenu } from "@/components/data-io";
import { ConfirmDelete } from "@/components/confirm";
import { ImportPreview, type FieldDef, type ColumnMapping, type ImportResult } from "@/components/import-preview";
import { pickFile, parseFile, parsearFechaGanadera } from "@/lib/io";
import { generarInformeRodeo } from "@/lib/pdf-reports";
import { FileDown } from "lucide-react";

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

const emptyForm = {
  caravana: "", rfid: "", sexo: "hembra", fecha_nacimiento: "", peso_actual: "",
  raza_id: "", categoria_id: "", estado_reproductivo: "",
};

function AnimalesPage() {
  const { activeId, active } = useActiveEstablecimiento();
  const [items, setItems] = useState<Animal[]>([]);
  const [razas, setRazas] = useState<{ id: string; nombre: string }[]>([]);
  const [cats, setCats] = useState<{ id: string; nombre: string }[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);

  // Definición de campos para el ImportPreview
  const ANIMAL_FIELDS: FieldDef[] = [
    {
      key: "caravana", label: "Caravana", required: true, esCaravana: true,
      aliases: ["caravana", "nro", "numero", "id animal", "tag", "nro animal", "identificacion", "id"],
      validate: (v) => !v.trim() ? "Caravana vacía" : null,
    },
    { key: "rfid", label: "RFID", aliases: ["rfid", "chip", "electronico", "caravana electronica"] },
    {
      key: "sexo", label: "Sexo", aliases: ["sexo", "sex", "genero", "género"], hint: "macho / hembra",
      validate: (v) => v && !["macho","hembra","m","h","♂","♀","macho","hembra"].includes(v.trim().toLowerCase())
        ? `Sexo inválido: "${v}" (esperado: macho/hembra/m/h)` : null,
    },
    {
      key: "fecha_nacimiento", label: "Fecha nacimiento", esFecha: true,
      aliases: ["fecha nacimiento", "nacimiento", "fnac", "fecha nac", "fecha de nacimiento", "fn", "f nac", "fechanac"],
    },
    {
      key: "peso", label: "Peso (kg)", aliases: ["peso", "peso actual", "peso kg", "kg", "peso vivo"],
      validate: (v) => v && isNaN(Number(String(v).replace(",","."))) ? `Peso inválido: "${v}"` : null,
    },
    { key: "raza", label: "Raza", aliases: ["raza", "breed", "raza bovina", "raza animal"] },
    { key: "categoria", label: "Categoría", aliases: ["categoria", "cat", "tipo", "categoria animal", "cat animal"] },
    { key: "potrero", label: "Potrero", aliases: ["potrero", "campo", "lote", "paddock", "lote potrero"] },
    { key: "estado", label: "Estado", aliases: ["estado", "status", "estado animal"], hint: "activo / vendido / muerto" },
    { key: "observaciones", label: "Observaciones", aliases: ["observaciones", "obs", "notas", "nota", "comentarios"] },
  ];

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
    const payload = {
      establecimiento_id: activeId,
      caravana: form.caravana.trim(),
      rfid: form.rfid || null,
      sexo: form.sexo as "macho" | "hembra",
      fecha_nacimiento: form.fecha_nacimiento || null,
      peso_actual: form.peso_actual ? Number(form.peso_actual) : null,
      raza_id: form.raza_id || null,
      categoria_id: form.categoria_id || null,
      estado_reproductivo: form.estado_reproductivo || null,
    };
    const { error } = editing
      ? await supabase.from("animales").update(payload).eq("id", editing)
      : await supabase.from("animales").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Animal actualizado" : "Animal creado");
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
    load();
  }

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(a: Animal) {
    setEditing(a.id);
    setForm({
      caravana: a.caravana,
      rfid: a.rfid ?? "",
      sexo: a.sexo,
      fecha_nacimiento: a.fecha_nacimiento ?? "",
      peso_actual: a.peso_actual?.toString() ?? "",
      raza_id: a.raza_id ?? "",
      categoria_id: a.categoria_id ?? "",
      estado_reproductivo: a.estado_reproductivo ?? "",
    });
    setOpen(true);
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("animales").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Animal eliminado");
    load();
  }

  async function handleImportFile() {
    const file = await pickFile();
    if (!file) return;
    const rows = await parseFile(file);
    if (!rows.length) { toast.error("El archivo está vacío o no tiene filas válidas"); return; }
    setPreviewRows(rows);
    setPreviewOpen(true);
  }

  async function handleImport(mapping: ColumnMapping, rows: Record<string, string>[]): Promise<ImportResult> {
    setPreviewOpen(false);
    if (!activeId) return;
    const razaMapName = new Map(razas.map((r) => [r.nombre.toLowerCase(), r.id]));
    const catMapName = new Map(cats.map((c) => [c.nombre.toLowerCase(), c.id]));
    // Cargar potreros para mapeo por nombre
    const { data: potData } = await supabase.from("potreros").select("id, nombre").eq("establecimiento_id", activeId!);
    const potreroMapName = new Map((potData ?? []).map((p: any) => [p.nombre.toLowerCase(), p.id]));

    // Detectar potreros del archivo que no existen en la BD
    const potreroCol = Object.entries(mapping).find(([, v]) => v === "potrero")?.[0];
    if (potreroCol) {
      const nombresEnArchivo = [...new Set(
        rows.map(r => (r[potreroCol] ?? "").trim()).filter(Boolean)
      )];
      const faltantes = nombresEnArchivo.filter(n => !potreroMapName.has(n.toLowerCase()));
      if (faltantes.length > 0) {
        const crear = window.confirm(
          `Los siguientes potreros del archivo no existen en el sistema:\n\n` +
          faltantes.map(n => `  • ${n}`).join("\n") +
          `\n\nAceptar = CREAR automáticamente estos potreros.\nCancelar = Ignorar animales con esos potreros.`
        );
        if (crear) {
          for (const nombre of faltantes) {
            const { data: nuevo } = await supabase.from("potreros")
              .insert({ establecimiento_id: activeId!, nombre, hectareas: 0, estado: "disponible" })
              .select("id, nombre").single();
            if (nuevo) potreroMapName.set(nuevo.nombre.toLowerCase(), nuevo.id);
          }
          toast.success(`${faltantes.length} potrero(s) creado(s) automáticamente`);
        }
      }
    }

    // Función helper: obtiene valor usando el mapping
    const pick = (row: Record<string, unknown>, fieldKey: string): string => {
      const excelCol = Object.entries(mapping).find(([, v]) => v === fieldKey)?.[0];
      if (!excelCol) return "";
      const val = row[excelCol];
      if (val === null || val === undefined || val === "") return "";
      return String(val).trim();
    };

    const mapped = rows
      .map((r, idx) => {
        const caravana = pick(r, "caravana");
        if (!caravana) return null;
        const sexoRaw = pick(r, "sexo").toLowerCase();
        const sexo = sexoRaw.startsWith("m") || sexoRaw === "♂" ? "macho" : "hembra";
        const raza = pick(r, "raza").toLowerCase();
        const cat = pick(r, "categoria").toLowerCase();
        const peso = pick(r, "peso");
        const fnac = pick(r, "fecha_nacimiento");
        // Parseo seguro de fecha con soporte DD/MM/YYYY, DDMMYY, DDMMYYYY, ISO
        const fechaNac = fnac ? parsearFechaGanadera(fnac) : null;
        const potreroNombre = pick(r, "potrero").toLowerCase();
        const potreroId = potreroNombre ? potreroMapName.get(potreroNombre) ?? null : null;
        return {
          _rowIndex: idx + 2,
          establecimiento_id: activeId,
          caravana,
          rfid: pick(r, "rfid") || null,
          sexo: sexo as "macho" | "hembra",
          peso_actual: peso ? Number(String(peso).replace(",", ".")) : null,
          fecha_nacimiento: fechaNac,
          raza_id: razaMapName.get(raza) ?? null,
          categoria_id: catMapName.get(cat) ?? null,
          potrero_id: potreroId,
          estado: pick(r, "estado") || "activo",
          observaciones: pick(r, "observaciones") || null,
        };
      })
      .filter(Boolean) as any[];

    if (mapped.length === 0) {
      toast.error("No se encontraron filas válidas (la columna Caravana está vacía o sin mapear)");
      return;
    }

    // Detectar duplicados dentro del archivo
    const seen = new Map<string, number[]>();
    for (const row of mapped) {
      const key = String(row.caravana).toLowerCase();
      const list = seen.get(key) ?? [];
      list.push(row._rowIndex);
      seen.set(key, list);
    }
    const duplicateGroups = Array.from(seen.entries()).filter(([, rows]) => rows.length > 1);
    let strategy: "merge" | "ignore" = "merge";
    if (duplicateGroups.length > 0) {
      const preview = duplicateGroups.slice(0, 10)
        .map(([car, rows]) => `  • Caravana "${car}" — filas ${rows.join(", ")}`)
        .join("\n");
      const more = duplicateGroups.length > 10 ? `\n  …y ${duplicateGroups.length - 10} más` : "";
      strategy = window.confirm(
        `Se detectaron ${duplicateGroups.length} caravana(s) duplicada(s):\n\n${preview}${more}\n\nAceptar = FUSIONAR (conservar la última fila).\nCancelar = IGNORAR duplicados (conservar la primera fila).`
      ) ? "merge" : "ignore";
    }
    const dedup = new Map<string, any>();
    for (const row of mapped) {
      const key = String(row.caravana).toLowerCase();
      if (strategy === "merge" || !dedup.has(key)) dedup.set(key, row);
    }
    const payload = Array.from(dedup.values()).map(({ _rowIndex, ...r }) => r);
    const BATCH = 500;
    let inserted = 0;
    const errors: string[] = [];
    for (let i = 0; i < payload.length; i += BATCH) {
      const batch = payload.slice(i, i + BATCH);
      const { error, count } = await supabase
        .from("animales")
        .upsert(batch, { onConflict: "establecimiento_id,caravana", count: "exact" });
      if (error) {
        errors.push(`Lote ${Math.floor(i / BATCH) + 1}: ${error.message}`);
      } else {
        inserted += count ?? batch.length;
      }
    }
    const rowErrors: ImportResult["errores"] = [];
    for (const e of errors) rowErrors.push({ fila: 0, caravana: "lote", motivo: e });
    if (rowErrors.length === 0) toast.success(`${inserted} animales importados`);
    else toast.warning(`${inserted} importados · ${rowErrors.length} errores`);
    load();
    return { total: payload.length, insertados: inserted, actualizados: 0, errores: rowErrors };
  }

  if (!active) return <div className="p-8">Seleccioná un establecimiento.</div>;

  const catMap = new Map(cats.map((c) => [c.id, c.nombre]));
  const razaMap = new Map(razas.map((r) => [r.id, r.nombre]));
  const filtered = items.filter((a) => !q || a.caravana.toLowerCase().includes(q.toLowerCase()) || a.rfid?.toLowerCase().includes(q.toLowerCase()));

  const exportCols = [
    { key: "caravana", header: "caravana" },
    { key: "rfid", header: "rfid" },
    { key: "sexo", header: "sexo" },
    { key: "categoria_id", header: "categoria", get: (a: Animal) => catMap.get(a.categoria_id ?? "") ?? "" },
    { key: "raza_id", header: "raza", get: (a: Animal) => razaMap.get(a.raza_id ?? "") ?? "" },
    { key: "fecha_nacimiento", header: "fecha_nacimiento" },
    { key: "peso_actual", header: "peso_actual" },
    { key: "estado", header: "estado" },
    { key: "estado_reproductivo", header: "estado_reproductivo" },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Animales</h1>
          <p className="text-muted-foreground text-sm">{items.length} animales en {active.nombre}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => generarInformeRodeo(activeId!, active.nombre)}>
            <FileDown className="h-4 w-4 mr-2" />PDF
          </Button>
          <Button variant="outline" onClick={handleImportFile}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Importar Excel
          </Button>
          <ExportMenu items={filtered} cols={exportCols} filename={`animales_${active.nombre}`} />
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nuevo animal</Button>
        </div>

        <ImportPreview
          open={previewOpen}
          rows={previewRows}
          fieldDefs={ANIMAL_FIELDS}
          keyColumn={previewRows[0] ? (Object.keys(previewRows[0]).find(k =>
            ["caravana","numero","nro","tag","id"].includes(k.trim().toLowerCase())
          ) ?? Object.keys(previewRows[0])[0]) : undefined}
          onConfirm={handleImport}
          onClose={() => setPreviewOpen(false)}
        />
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(emptyForm); } }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editing ? "Editar animal" : "Nuevo animal"}</DialogTitle></DialogHeader>
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
              <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear"}</Button></DialogFooter>
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
              <TableHead className="w-24 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((a) => (
              <TableRow key={a.id} className="hover:bg-muted/50">
                <TableCell className="font-medium"><Link to="/animales/$id" params={{ id: a.id }}>{a.caravana}</Link></TableCell>
                <TableCell>{a.sexo === "hembra" ? "♀" : "♂"}</TableCell>
                <TableCell>{catMap.get(a.categoria_id ?? "") ?? "—"}</TableCell>
                <TableCell>{razaMap.get(a.raza_id ?? "") ?? "—"}</TableCell>
                <TableCell>{fmtDate(a.fecha_nacimiento)}</TableCell>
                <TableCell className="text-right tabular-nums">{a.peso_actual ? fmtNum(a.peso_actual) : "—"}</TableCell>
                <TableCell><Badge variant={a.estado === "activo" ? "default" : "secondary"}>{a.estado}</Badge></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <ConfirmDelete
                      title={`¿Eliminar ${a.caravana}?`}
                      description="Se borrarán también todas sus pesadas, tratamientos y movimientos."
                      onConfirm={() => handleDelete(a.id)}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No hay animales que mostrar</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}