import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEstablecimiento } from "@/hooks/use-establecimiento";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Droplets, Fence, Plus } from "lucide-react";
import { fmtNum } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/infraestructura")({
  head: () => ({ meta: [{ title: "Infraestructura — Ganadero IA" }] }),
  component: InfraPage,
});

type Aguada = { id: string; nombre: string; tipo: string; capacidad_litros: number | null; estado: string };
type Alambrado = { id: string; nombre: string; tipo: string; km: number; hilos: number | null; estado: string };

function InfraPage() {
  const { activeId } = useActiveEstablecimiento();
  const [aguadas, setAguadas] = useState<Aguada[]>([]);
  const [alambs, setAlambs] = useState<Alambrado[]>([]);
  const [ag, setAg] = useState({ nombre: "", tipo: "tanque", capacidad_litros: "", estado: "operativa" });
  const [al, setAl] = useState({ nombre: "", tipo: "perimetral", km: "", hilos: "5", estado: "bueno" });

  async function load() {
    if (!activeId) return;
    const [{ data: a }, { data: l }] = await Promise.all([
      supabase.from("aguadas").select("*").eq("establecimiento_id", activeId).order("nombre"),
      supabase.from("alambrados").select("*").eq("establecimiento_id", activeId).order("nombre"),
    ]);
    setAguadas((a as Aguada[]) ?? []);
    setAlambs((l as Alambrado[]) ?? []);
  }
  useEffect(() => { load(); }, [activeId]);

  async function saveAg(e: React.FormEvent) {
    e.preventDefault(); if (!activeId) return;
    const { error } = await supabase.from("aguadas").insert({
      establecimiento_id: activeId, nombre: ag.nombre, tipo: ag.tipo,
      capacidad_litros: ag.capacidad_litros ? Number(ag.capacidad_litros) : null, estado: ag.estado,
    });
    if (error) return toast.error(error.message);
    toast.success("Aguada agregada"); setAg({ nombre: "", tipo: "tanque", capacidad_litros: "", estado: "operativa" }); load();
  }
  async function saveAl(e: React.FormEvent) {
    e.preventDefault(); if (!activeId) return;
    const { error } = await supabase.from("alambrados").insert({
      establecimiento_id: activeId, nombre: al.nombre, tipo: al.tipo, km: Number(al.km || 0),
      hilos: al.hilos ? Number(al.hilos) : null, estado: al.estado,
    });
    if (error) return toast.error(error.message);
    toast.success("Alambrado agregado"); setAl({ nombre: "", tipo: "perimetral", km: "", hilos: "5", estado: "bueno" }); load();
  }

  const totalKm = alambs.reduce((s, x) => s + Number(x.km), 0);
  const totalLts = aguadas.reduce((s, x) => s + Number(x.capacidad_litros || 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Infraestructura</h1>
        <p className="text-muted-foreground text-sm">Aguadas y alambrados del campo.</p>
      </div>

      <Tabs defaultValue="aguadas">
        <TabsList><TabsTrigger value="aguadas"><Droplets className="h-4 w-4 mr-2" />Aguadas</TabsTrigger><TabsTrigger value="alambrados"><Fence className="h-4 w-4 mr-2" />Alambrados</TabsTrigger></TabsList>

        <TabsContent value="aguadas" className="space-y-4">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Capacidad total</div>
            <div className="text-2xl font-bold">{fmtNum(totalLts, 0)} L · {aguadas.length} aguadas</div>
          </Card>
          <Card className="p-4">
            <form onSubmit={saveAg} className="grid md:grid-cols-5 gap-3 items-end">
              <div><Label>Nombre</Label><Input required value={ag.nombre} onChange={(e) => setAg({ ...ag, nombre: e.target.value })} /></div>
              <div><Label>Tipo</Label>
                <Select value={ag.tipo} onValueChange={(v) => setAg({ ...ag, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="molino">Molino</SelectItem><SelectItem value="tanque">Tanque</SelectItem>
                    <SelectItem value="represa">Represa</SelectItem><SelectItem value="vertiente">Vertiente</SelectItem>
                    <SelectItem value="perforacion">Perforación</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Capacidad (L)</Label><Input type="number" value={ag.capacidad_litros} onChange={(e) => setAg({ ...ag, capacidad_litros: e.target.value })} /></div>
              <div><Label>Estado</Label>
                <Select value={ag.estado} onValueChange={(v) => setAg({ ...ag, estado: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="operativa">Operativa</SelectItem><SelectItem value="mantenimiento">Mantenimiento</SelectItem><SelectItem value="fuera_servicio">Fuera de servicio</SelectItem></SelectContent>
                </Select>
              </div>
              <Button type="submit"><Plus className="h-4 w-4 mr-1" />Agregar</Button>
            </form>
          </Card>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {aguadas.map((a) => (
              <Card key={a.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{a.nombre}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${a.estado === "operativa" ? "bg-primary/15 text-primary" : a.estado === "mantenimiento" ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" : "bg-destructive/15 text-destructive"}`}>{a.estado}</span>
                </div>
                <div className="text-sm text-muted-foreground mt-1 capitalize">{a.tipo}</div>
                {a.capacidad_litros && <div className="text-sm mt-1">{fmtNum(a.capacidad_litros, 0)} L</div>}
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="alambrados" className="space-y-4">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Total perímetro</div>
            <div className="text-2xl font-bold">{fmtNum(totalKm, 2)} km · {alambs.length} tramos</div>
          </Card>
          <Card className="p-4">
            <form onSubmit={saveAl} className="grid md:grid-cols-6 gap-3 items-end">
              <div className="md:col-span-2"><Label>Nombre</Label><Input required value={al.nombre} onChange={(e) => setAl({ ...al, nombre: e.target.value })} /></div>
              <div><Label>Tipo</Label>
                <Select value={al.tipo} onValueChange={(v) => setAl({ ...al, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="perimetral">Perimetral</SelectItem><SelectItem value="division">División</SelectItem><SelectItem value="electrico">Eléctrico</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Km</Label><Input type="number" step="0.01" required value={al.km} onChange={(e) => setAl({ ...al, km: e.target.value })} /></div>
              <div><Label>Hilos</Label><Input type="number" value={al.hilos} onChange={(e) => setAl({ ...al, hilos: e.target.value })} /></div>
              <Button type="submit"><Plus className="h-4 w-4 mr-1" />Agregar</Button>
            </form>
          </Card>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {alambs.map((a) => (
              <Card key={a.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{a.nombre}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${a.estado === "bueno" ? "bg-primary/15 text-primary" : a.estado === "regular" ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" : "bg-destructive/15 text-destructive"}`}>{a.estado}</span>
                </div>
                <div className="text-sm text-muted-foreground mt-1 capitalize">{a.tipo} · {fmtNum(a.km, 2)} km {a.hilos && `· ${a.hilos} hilos`}</div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}