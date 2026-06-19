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

export const Route = createFileRoute("/_authenticated/reproduccion")({
  head: () => ({ meta: [{ title: "Reproducción — Ganadero IA" }] }),
  component: ReproPage,
});

async function findAnimal(estId: string, caravana: string) {
  const { data } = await supabase.from("animales").select("id").eq("establecimiento_id", estId).eq("caravana", caravana.trim()).maybeSingle();
  return data?.id ?? null;
}

function ReproPage() {
  const { activeId, active } = useActiveEstablecimiento();
  if (!active) return <div className="p-8">Seleccioná un establecimiento.</div>;
  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Reproducción</h1>
        <p className="text-muted-foreground text-sm">Servicios, tactos, pariciones y destetes.</p>
      </div>
      <Tabs defaultValue="servicio">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="servicio">Servicio</TabsTrigger>
          <TabsTrigger value="tacto">Tacto</TabsTrigger>
          <TabsTrigger value="parto">Parición</TabsTrigger>
          <TabsTrigger value="destete">Destete</TabsTrigger>
        </TabsList>
        <TabsContent value="servicio"><ServicioForm estId={activeId!} /></TabsContent>
        <TabsContent value="tacto"><TactoForm estId={activeId!} /></TabsContent>
        <TabsContent value="parto"><PartoForm estId={activeId!} /></TabsContent>
        <TabsContent value="destete"><DesteteForm estId={activeId!} /></TabsContent>
      </Tabs>
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
    const { error } = await supabase.from("destetes").insert({ establecimiento_id: estId, cria_id: criaId, peso_destete: peso ? Number(peso) : null, fecha });
    setSaving(false); if (error) return toast.error(error.message);
    if (peso) await supabase.from("pesadas").insert({ establecimiento_id: estId, animal_id: criaId, peso: Number(peso), fecha });
    toast.success("Destete registrado"); setCria(""); setPeso("");
  }
  return <Card className="p-6 mt-4"><form onSubmit={submit} className="space-y-4">
    <div><Label>Caravana cría *</Label><Input autoFocus required value={cria} onChange={(e) => setCria(e.target.value)} className="h-14 text-2xl tabular-nums" /></div>
    <div><Label>Peso destete (kg)</Label><Input type="number" step="0.1" value={peso} onChange={(e) => setPeso(e.target.value)} className="h-14 text-2xl tabular-nums" /></div>
    <div><Label>Fecha</Label><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-12" /></div>
    <Button type="submit" disabled={saving} className="w-full h-14 text-lg">{saving ? "Guardando…" : "Registrar destete"}</Button>
  </form></Card>;
}