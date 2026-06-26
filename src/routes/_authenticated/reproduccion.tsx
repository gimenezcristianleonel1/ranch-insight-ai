import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEstablecimiento } from "@/hooks/use-establecimiento";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Upload, FileDown } from "lucide-react";
import { generarInformeReproductivo } from "@/lib/pdf-reports";
import { ImportPreview, type FieldDef, type ColumnMapping, type ImportResult } from "@/components/import-preview";
import { pickFile, parseFile, parsearFechaGanadera } from "@/lib/io";

export const Route = createFileRoute("/_authenticated/reproduccion")({
  head: () => ({ meta: [{ title: "Reproducción — Ganadero IA" }] }),
  component: ReproPage,
});

async function findAnimal(estId: string, caravana: string) {
  const { data } = await supabase.from("animales").select("id").eq("establecimiento_id", estId).eq("caravana", caravana.trim()).maybeSingle();
  return data?.id ?? null;
}

// ── FieldDefs por sub-módulo ──────────────────────────────────────────────────

const SERVICIO_FIELDS: FieldDef[] = [
  { key: "caravana_vaca", label: "Caravana Vaca", required: true, esCaravana: true,
    aliases: ["vaca", "caravana vaca", "caravana madre", "madre", "nro vaca"] },
  { key: "tipo", label: "Tipo", aliases: ["tipo", "tipo servicio", "metodo"],
    hint: "natural / ia / iatf" },
  { key: "caravana_toro", label: "Caravana Toro", esCaravana: true,
    aliases: ["toro", "caravana toro", "padre", "nro toro"] },
  { key: "fecha", label: "Fecha", esFecha: true,
    aliases: ["fecha", "fecha servicio", "fecha inseminacion", "date"] },
  { key: "observaciones", label: "Observaciones",
    aliases: ["observaciones", "obs", "notas"] },
];

const TACTO_FIELDS: FieldDef[] = [
  { key: "caravana_vaca", label: "Caravana Vaca", required: true, esCaravana: true,
    aliases: ["vaca", "caravana vaca", "madre", "nro vaca", "caravana"] },
  { key: "resultado", label: "Resultado", required: true,
    aliases: ["resultado", "diagnostico", "tacto", "preñez"],
    hint: "pos / neg / prenada / vacia / + / -",
    validate: v => {
      if (!v.trim()) return "Resultado vacío";
      return null;
    } },
  { key: "edad_fetal", label: "Edad fetal (días)",
    aliases: ["edad fetal", "dias", "edad", "meses"],
    validate: v => v && isNaN(Number(v)) ? `Edad inválida: "${v}"` : null },
  { key: "fecha", label: "Fecha", esFecha: true,
    aliases: ["fecha", "fecha tacto", "fecha diagnostico", "date"] },
];

const PARICION_FIELDS: FieldDef[] = [
  { key: "caravana_vaca", label: "Caravana Vaca", required: true, esCaravana: true,
    aliases: ["vaca", "caravana vaca", "madre", "nro vaca"] },
  { key: "caravana_cria", label: "Caravana Cría", esCaravana: true,
    aliases: ["cria", "caravana cria", "ternero", "ternera", "hijo"] },
  { key: "sexo_cria", label: "Sexo Cría",
    aliases: ["sexo", "sexo cria", "genero"], hint: "macho / hembra" },
  { key: "peso_nacimiento", label: "Peso nac. (kg)",
    aliases: ["peso", "peso nacimiento", "peso cria", "kg nac"],
    validate: v => v && isNaN(Number(v.replace(",","."))) ? `Peso inválido: "${v}"` : null },
  { key: "vivo", label: "Vivo",
    aliases: ["vivo", "estado cria", "nacio vivo"], hint: "si / no / 1 / 0" },
  { key: "fecha", label: "Fecha", esFecha: true,
    aliases: ["fecha", "fecha parto", "fecha paricion", "date"] },
];

// ── Helpers de normalización ──────────────────────────────────────────────────

function normalizarResultadoTacto(v: string): boolean {
  const t = v.trim().toLowerCase();
  return ["pos","positivo","prenada","preñada","1","si","sí","+","true"].includes(t);
}

function normalizarSexo(v: string): "macho" | "hembra" {
  const t = v.trim().toLowerCase();
  return t.startsWith("m") || t === "♂" ? "macho" : "hembra";
}

function normalizarVivo(v: string): boolean {
  const t = v.trim().toLowerCase();
  return !["no","0","false","muerto","mort","x"].includes(t);
}

// ── ReproPage con importadores ────────────────────────────────────────────────

function ReproPage() {
  const { activeId, active } = useActiveEstablecimiento();

  // Estados de importación por sub-módulo
  const [importTab, setImportTab] = useState<"servicio"|"tacto"|"paricion"|null>(null);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);

  async function handlePickFile(tab: "servicio"|"tacto"|"paricion") {
    const file = await pickFile();
    if (!file) return;
    const rows = await parseFile(file);
    if (!rows.length) { toast.error("El archivo está vacío"); return; }
    setPreviewRows(rows);
    setImportTab(tab);
  }

  // ── Importar servicios ──
  async function handleImportServicios(mapping: ColumnMapping, rows: Record<string, string>[]): Promise<ImportResult> {
    if (!activeId) return { total: 0, insertados: 0, actualizados: 0, errores: [] };
    const pick = (r: Record<string, string>, k: string) => {
      const col = Object.entries(mapping).find(([,v]) => v === k)?.[0];
      return col ? (r[col] ?? "").trim() : "";
    };
    const fechaDefault = new Date().toISOString().slice(0, 10);
    const errores: ImportResult["errores"] = [];
    const vacas = [...new Set(rows.map(r => pick(r, "caravana_vaca")).filter(Boolean))];
    const toros = [...new Set(rows.map(r => pick(r, "caravana_toro")).filter(Boolean))];
    const allCars = [...new Set([...vacas, ...toros])];
    const { data: animals } = await supabase.from("animales").select("id, caravana")
      .eq("establecimiento_id", activeId).in("caravana", allCars);
    const animalMap = new Map((animals ?? []).map(a => [a.caravana.toLowerCase(), a.id]));
    const payload: any[] = [];
    rows.forEach((row, idx) => {
      const fila = idx + 2;
      const carVaca = pick(row, "caravana_vaca");
      if (!carVaca) { errores.push({ fila, caravana: "", motivo: "Caravana vaca vacía" }); return; }
      const vacaId = animalMap.get(carVaca.toLowerCase());
      if (!vacaId) { errores.push({ fila, caravana: carVaca, motivo: "Vaca no encontrada" }); return; }
      const carToro = pick(row, "caravana_toro");
      const toroId = carToro ? (animalMap.get(carToro.toLowerCase()) ?? null) : null;
      const tipoRaw = pick(row, "tipo").toLowerCase();
      const tipo = tipoRaw.includes("iatf") ? "iatf" : tipoRaw.includes("ia") ? "ia" : "natural";
      const fechaRaw = pick(row, "fecha");
      payload.push({
        establecimiento_id: activeId, vaca_id: vacaId, toro_id: toroId, tipo,
        fecha: fechaRaw ? (parsearFechaGanadera(fechaRaw) ?? fechaDefault) : fechaDefault,
        observaciones: pick(row, "observaciones") || null,
      });
    });
    const { error, count } = await supabase.from("servicios").insert(payload, { count: "exact" });
    if (error) errores.push({ fila: 0, caravana: "lote", motivo: error.message });
    const insertados = count ?? payload.length;
    if (insertados > 0) toast.success(`${insertados} servicios importados`);
    return { total: rows.length, insertados, actualizados: 0, errores };
  }

  // ── Importar tactos ──
  async function handleImportTactos(mapping: ColumnMapping, rows: Record<string, string>[]): Promise<ImportResult> {
    if (!activeId) return { total: 0, insertados: 0, actualizados: 0, errores: [] };
    const pick = (r: Record<string, string>, k: string) => {
      const col = Object.entries(mapping).find(([,v]) => v === k)?.[0];
      return col ? (r[col] ?? "").trim() : "";
    };
    const fechaDefault = new Date().toISOString().slice(0, 10);
    const errores: ImportResult["errores"] = [];
    const vacas = [...new Set(rows.map(r => pick(r, "caravana_vaca")).filter(Boolean))];
    const { data: animals } = await supabase.from("animales").select("id, caravana")
      .eq("establecimiento_id", activeId).in("caravana", vacas);
    const animalMap = new Map((animals ?? []).map(a => [a.caravana.toLowerCase(), a.id]));
    const payload: any[] = [];
    const updates: { id: string; repro: string }[] = [];
    rows.forEach((row, idx) => {
      const fila = idx + 2;
      const carVaca = pick(row, "caravana_vaca");
      const resultadoRaw = pick(row, "resultado");
      if (!carVaca) { errores.push({ fila, caravana: "", motivo: "Caravana vacía" }); return; }
      if (!resultadoRaw) { errores.push({ fila, caravana: carVaca, motivo: "Resultado vacío" }); return; }
      const vacaId = animalMap.get(carVaca.toLowerCase());
      if (!vacaId) { errores.push({ fila, caravana: carVaca, motivo: "Vaca no encontrada" }); return; }
      const resultado = normalizarResultadoTacto(resultadoRaw);
      const edadRaw = pick(row, "edad_fetal");
      const fechaRaw = pick(row, "fecha");
      payload.push({
        establecimiento_id: activeId, vaca_id: vacaId, resultado,
        edad_fetal_dias: resultado && edadRaw ? Number(edadRaw) || null : null,
        fecha: fechaRaw ? (parsearFechaGanadera(fechaRaw) ?? fechaDefault) : fechaDefault,
      });
      updates.push({ id: vacaId, repro: resultado ? "prenada" : "vacia" });
    });
    const { error, count } = await supabase.from("diagnosticos").insert(payload, { count: "exact" });
    if (!error) {
      for (const u of updates) {
        await supabase.from("animales").update({ estado_reproductivo: u.repro }).eq("id", u.id);
      }
    }
    if (error) errores.push({ fila: 0, caravana: "lote", motivo: error.message });
    const insertados = count ?? payload.length;
    if (insertados > 0) toast.success(`${insertados} tactos importados`);
    return { total: rows.length, insertados, actualizados: 0, errores };
  }

  // ── Importar pariciones ──
  async function handleImportPariciones(mapping: ColumnMapping, rows: Record<string, string>[]): Promise<ImportResult> {
    if (!activeId) return { total: 0, insertados: 0, actualizados: 0, errores: [] };
    const pick = (r: Record<string, string>, k: string) => {
      const col = Object.entries(mapping).find(([,v]) => v === k)?.[0];
      return col ? (r[col] ?? "").trim() : "";
    };
    const fechaDefault = new Date().toISOString().slice(0, 10);
    const errores: ImportResult["errores"] = [];
    const vacas = [...new Set(rows.map(r => pick(r, "caravana_vaca")).filter(Boolean))];
    const { data: animals } = await supabase.from("animales").select("id, caravana")
      .eq("establecimiento_id", activeId).in("caravana", vacas);
    const animalMap = new Map((animals ?? []).map(a => [a.caravana.toLowerCase(), a.id]));
    const { data: cats } = await supabase.from("categorias").select("id, nombre");
    const catMap = new Map((cats ?? []).map(c => [c.nombre.toLowerCase(), c.id]));
    let insertados = 0;
    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const fila = idx + 2;
      const carVaca = pick(row, "caravana_vaca");
      if (!carVaca) { errores.push({ fila, caravana: "", motivo: "Caravana vaca vacía" }); continue; }
      const vacaId = animalMap.get(carVaca.toLowerCase());
      if (!vacaId) { errores.push({ fila, caravana: carVaca, motivo: "Vaca no encontrada" }); continue; }
      const sexo = normalizarSexo(pick(row, "sexo_cria") || "hembra");
      const vivoRaw = pick(row, "vivo");
      const vivo = vivoRaw ? normalizarVivo(vivoRaw) : true;
      const pesoRaw = pick(row, "peso_nacimiento");
      const pesoNac = pesoRaw ? Number(pesoRaw.replace(",",".")) || null : null;
      const carCria = pick(row, "caravana_cria");
      const fechaRaw = pick(row, "fecha");
      const fecha = fechaRaw ? (parsearFechaGanadera(fechaRaw) ?? fechaDefault) : fechaDefault;
      let criaId: string | null = null;
      if (vivo && carCria) {
        const catName = sexo === "hembra" ? "ternera" : "ternero";
        const catId = catMap.get(catName) ?? null;
        const { data: ins } = await supabase.from("animales").insert({
          establecimiento_id: activeId, caravana: carCria, sexo,
          fecha_nacimiento: fecha, peso_actual: pesoNac, madre_id: vacaId, categoria_id: catId,
        }).select("id").single();
        criaId = ins?.id ?? null;
      }
      const { error } = await supabase.from("pariciones").insert({
        establecimiento_id: activeId, vaca_id: vacaId, cria_id: criaId,
        sexo_cria: sexo, peso_nacimiento: pesoNac, vivo, fecha,
      });
      if (error) { errores.push({ fila, caravana: carVaca, motivo: error.message }); continue; }
      await supabase.from("animales").update({ estado_reproductivo: "parida" }).eq("id", vacaId);
      insertados++;
    }
    if (insertados > 0) toast.success(`${insertados} pariciones importadas`);
    return { total: rows.length, insertados, actualizados: 0, errores };
  }

  if (!active) return <div className="p-8">Seleccioná un establecimiento.</div>;
  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Reproducción</h1>
          <p className="text-muted-foreground text-sm">Servicios, tactos, pariciones y destetes.</p>
        </div>
        <Button variant="outline" onClick={() => generarInformeReproductivo(activeId!, active.nombre)}>
          <FileDown className="h-4 w-4 mr-2" />PDF Reproducción
        </Button>
      </div>
      <Tabs defaultValue="servicio">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="servicio">Servicio</TabsTrigger>
          <TabsTrigger value="tacto">Tacto</TabsTrigger>
          <TabsTrigger value="parto">Parición</TabsTrigger>
          <TabsTrigger value="destete">Destete</TabsTrigger>
        </TabsList>
        <TabsContent value="servicio">
          <div className="flex justify-end mt-3 mb-1">
            <Button variant="outline" size="sm" onClick={() => handlePickFile("servicio")}>
              <Upload className="h-3.5 w-3.5 mr-1.5" />Importar Excel
            </Button>
          </div>
          <ServicioForm estId={activeId!} />
        </TabsContent>
        <TabsContent value="tacto">
          <div className="flex justify-end mt-3 mb-1">
            <Button variant="outline" size="sm" onClick={() => handlePickFile("tacto")}>
              <Upload className="h-3.5 w-3.5 mr-1.5" />Importar Excel
            </Button>
          </div>
          <TactoForm estId={activeId!} />
        </TabsContent>
        <TabsContent value="parto">
          <div className="flex justify-end mt-3 mb-1">
            <Button variant="outline" size="sm" onClick={() => handlePickFile("paricion")}>
              <Upload className="h-3.5 w-3.5 mr-1.5" />Importar Excel
            </Button>
          </div>
          <PartoForm estId={activeId!} />
        </TabsContent>
        <TabsContent value="destete"><DesteteForm estId={activeId!} /></TabsContent>
      </Tabs>

      {/* Importadores */}
      <ImportPreview
        open={importTab === "servicio"}
        rows={previewRows}
        fieldDefs={SERVICIO_FIELDS}
        tipo="reproduccion"
        onConfirm={handleImportServicios}
        onClose={() => setImportTab(null)}
      />
      <ImportPreview
        open={importTab === "tacto"}
        rows={previewRows}
        fieldDefs={TACTO_FIELDS}
        tipo="tactos"
        onConfirm={handleImportTactos}
        onClose={() => setImportTab(null)}
      />
      <ImportPreview
        open={importTab === "paricion"}
        rows={previewRows}
        fieldDefs={PARICION_FIELDS}
        tipo="reproduccion"
        onConfirm={handleImportPariciones}
        onClose={() => setImportTab(null)}
      />
    </div>
  );
}

function ServicioForm({ estId }: { estId: string }) {
  const [vaca, setVaca] = useState(""); const [toro, setToro] = useState(""); const [tipo, setTipo] = useState("natural"); const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10)); const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent) { e.preventDefault(); setSaving(true);
    const vacaId = await findAnimal(estId, vaca); if (!vacaId) { setSaving(false); return toast.error("Caravana de vaca no encontrada"); }
    const toroId = toro ? await findAnimal(estId, toro) : null;
    const { error } = await supabase.from("servicios").insert({ establecimiento_id: estId, vaca_id: vacaId, toro_id: toroId, tipo: tipo as any, fecha });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Servicio registrado"); setVaca(""); setToro("");
    await supabase.from("animales").update({ estado_reproductivo: "servida" }).eq("id", vacaId);
  }
  return <Card className="p-6 mt-4"><form onSubmit={submit} className="space-y-4">
    <div><Label>Caravana vaca *</Label><Input autoFocus required value={vaca} onChange={(e) => setVaca(e.target.value)} className="h-12 text-xl tabular-nums" /></div>
    <div className="grid grid-cols-2 gap-3">
      <div><Label>Tipo *</Label><Select value={tipo} onValueChange={setTipo}><SelectTrigger className="h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="natural">Natural</SelectItem><SelectItem value="ia">IA</SelectItem><SelectItem value="iatf">IATF</SelectItem></SelectContent></Select></div>
      <div><Label>Caravana toro</Label><Input value={toro} onChange={(e) => setToro(e.target.value)} className="h-12" /></div>
    </div>
    <div><Label>Fecha</Label><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-12" /></div>
    <Button type="submit" disabled={saving} className="w-full h-12 text-lg">{saving ? "Guardando…" : "Registrar servicio"}</Button>
  </form></Card>;
}

function TactoForm({ estId }: { estId: string }) {
  const [vaca, setVaca] = useState(""); const [resultado, setResultado] = useState<"pos" | "neg">("pos"); const [edad, setEdad] = useState("60"); const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10)); const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent) { e.preventDefault(); setSaving(true);
    const vacaId = await findAnimal(estId, vaca); if (!vacaId) { setSaving(false); return toast.error("Caravana no encontrada"); }
    const { error } = await supabase.from("diagnosticos").insert({ establecimiento_id: estId, vaca_id: vacaId, resultado: resultado === "pos", edad_fetal_dias: resultado === "pos" ? Number(edad) : null, fecha });
    setSaving(false); if (error) return toast.error(error.message);
    await supabase.from("animales").update({ estado_reproductivo: resultado === "pos" ? "prenada" : "vacia" }).eq("id", vacaId);
    toast.success(`Vaca ${vaca}: ${resultado === "pos" ? "Preñada" : "Vacía"}`); setVaca("");
  }
  return <Card className="p-6 mt-4"><form onSubmit={submit} className="space-y-4">
    <div><Label>Caravana *</Label><Input autoFocus required value={vaca} onChange={(e) => setVaca(e.target.value)} className="h-14 text-2xl tabular-nums" /></div>
    <div><Label>Resultado *</Label>
      <div className="grid grid-cols-2 gap-2 mt-1">
        <Button type="button" variant={resultado === "pos" ? "default" : "outline"} className="h-14 text-lg" onClick={() => setResultado("pos")}>Preñada</Button>
        <Button type="button" variant={resultado === "neg" ? "default" : "outline"} className="h-14 text-lg" onClick={() => setResultado("neg")}>Vacía</Button>
      </div>
    </div>
    {resultado === "pos" && (
      <div><Label>Edad fetal (días)</Label>
        <div className="grid grid-cols-4 gap-2 mt-1">
          {["30", "60", "90", "120"].map((d) => (
            <Button type="button" key={d} variant={edad === d ? "default" : "outline"} className="h-12" onClick={() => setEdad(d)}>{d}d</Button>
          ))}
        </div>
      </div>
    )}
    <div><Label>Fecha</Label><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-12" /></div>
    <Button type="submit" disabled={saving} className="w-full h-14 text-lg">{saving ? "Guardando…" : "Guardar tacto"}</Button>
  </form></Card>;
}

function PartoForm({ estId }: { estId: string }) {
  const [vaca, setVaca] = useState(""); const [sexo, setSexo] = useState<"hembra" | "macho">("hembra"); const [peso, setPeso] = useState(""); const [caravanaCria, setCaravanaCria] = useState(""); const [vivo, setVivo] = useState(true); const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10)); const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent) { e.preventDefault(); setSaving(true);
    const vacaId = await findAnimal(estId, vaca); if (!vacaId) { setSaving(false); return toast.error("Caravana de vaca no encontrada"); }
    let criaId: string | null = null;
    if (vivo && caravanaCria) {
      const { data: catTernero } = await supabase.from("categorias").select("id").eq("nombre", sexo === "hembra" ? "Ternera" : "Ternero").maybeSingle();
      const { data: ins, error: ec } = await supabase.from("animales").insert({
        establecimiento_id: estId, caravana: caravanaCria.trim(), sexo, fecha_nacimiento: fecha,
        peso_actual: peso ? Number(peso) : null, madre_id: vacaId, categoria_id: catTernero?.id ?? null,
      }).select("id").single();
      if (ec) { setSaving(false); return toast.error(ec.message); }
      criaId = ins.id;
    }
    const { error } = await supabase.from("pariciones").insert({ establecimiento_id: estId, vaca_id: vacaId, cria_id: criaId, sexo_cria: sexo, peso_nacimiento: peso ? Number(peso) : null, vivo, fecha });
    setSaving(false); if (error) return toast.error(error.message);
    await supabase.from("animales").update({ estado_reproductivo: "parida" }).eq("id", vacaId);
    toast.success("Parición registrada"); setVaca(""); setCaravanaCria(""); setPeso("");
  }
  return <Card className="p-6 mt-4"><form onSubmit={submit} className="space-y-4">
    <div><Label>Caravana vaca *</Label><Input autoFocus required value={vaca} onChange={(e) => setVaca(e.target.value)} className="h-12 text-xl tabular-nums" /></div>
    <div className="grid grid-cols-2 gap-2">
      <Button type="button" variant={vivo ? "default" : "outline"} className="h-12" onClick={() => setVivo(true)}>Vivo</Button>
      <Button type="button" variant={!vivo ? "default" : "outline"} className="h-12" onClick={() => setVivo(false)}>Muerto</Button>
    </div>
    {vivo && <>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant={sexo === "hembra" ? "default" : "outline"} className="h-12" onClick={() => setSexo("hembra")}>Hembra</Button>
        <Button type="button" variant={sexo === "macho" ? "default" : "outline"} className="h-12" onClick={() => setSexo("macho")}>Macho</Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Caravana cría</Label><Input value={caravanaCria} onChange={(e) => setCaravanaCria(e.target.value)} className="h-12" /></div>
        <div><Label>Peso nac. (kg)</Label><Input type="number" step="0.1" value={peso} onChange={(e) => setPeso(e.target.value)} className="h-12" /></div>
      </div>
    </>}
    <div><Label>Fecha</Label><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-12" /></div>
    <Button type="submit" disabled={saving} className="w-full h-12 text-lg">{saving ? "Guardando…" : "Registrar parición"}</Button>
  </form></Card>;
}

function DesteteForm({ estId }: { estId: string }) {
  const [cria, setCria] = useState(""); const [peso, setPeso] = useState(""); const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10)); const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent) { e.preventDefault(); setSaving(true);
    const criaId = await findAnimal(estId, cria); if (!criaId) { setSaving(false); return toast.error("Caravana no encontrada"); }

    // Obtener madre_id de la cría para actualizar su estado reproductivo
    const { data: criaData } = await supabase.from("animales").select("madre_id").eq("id", criaId).maybeSingle();

    const { error } = await supabase.from("destetes").insert({ establecimiento_id: estId, cria_id: criaId, peso_destete: peso ? Number(peso) : null, fecha });
    setSaving(false); if (error) return toast.error(error.message);

    // Registrar pesada si se cargó peso
    if (peso) await supabase.from("pesadas").insert({ establecimiento_id: estId, animal_id: criaId, peso: Number(peso), fecha });

    // Actualizar estado reproductivo de la madre a "vacia" post-destete
    if (criaData?.madre_id) {
      await supabase.from("animales").update({ estado_reproductivo: "vacia" }).eq("id", criaData.madre_id);
    }

    toast.success("Destete registrado"); setCria(""); setPeso("");
  }
  return <Card className="p-6 mt-4"><form onSubmit={submit} className="space-y-4">
    <div><Label>Caravana cría *</Label><Input autoFocus required value={cria} onChange={(e) => setCria(e.target.value)} className="h-14 text-2xl tabular-nums" /></div>
    <div><Label>Peso destete (kg)</Label><Input type="number" step="0.1" value={peso} onChange={(e) => setPeso(e.target.value)} className="h-14 text-2xl tabular-nums" /></div>
    <div><Label>Fecha</Label><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-12" /></div>
    <Button type="submit" disabled={saving} className="w-full h-14 text-lg">{saving ? "Guardando…" : "Registrar destete"}</Button>
  </form></Card>;
}