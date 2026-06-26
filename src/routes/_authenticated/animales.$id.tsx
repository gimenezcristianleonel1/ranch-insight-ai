import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fmtDate, fmtNum } from "@/lib/format";
import { ArrowLeft, Beef } from "lucide-react";
import { Attachments } from "@/components/attachments";

export const Route = createFileRoute("/_authenticated/animales/$id")({
  head: () => ({ meta: [{ title: "Animal — Ganadero IA" }] }),
  component: AnimalDetail,
});

function AnimalDetail() {
  const { id } = useParams({ from: "/_authenticated/animales/$id" });
  const [animal, setAnimal] = useState<any>(null);
  const [pesadas, setPesadas] = useState<any[]>([]);
  const [sanidad, setSanidad] = useState<any[]>([]);
  const [servicios, setServicios] = useState<any[]>([]);
  const [diags, setDiags] = useState<any[]>([]);
  const [madre, setMadre] = useState<any>(null);
  const [padre, setPadre] = useState<any>(null);
  const [crias, setCrias] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("animales").select("*, razas(nombre), categorias(nombre), potrero:potreros(nombre)").eq("id", id).single().then(({ data }) => {
      setAnimal(data);
      if (data?.madre_id) supabase.from("animales").select("id, caravana, categorias(nombre), razas(nombre)").eq("id", data.madre_id).single().then(({ data: m }) => setMadre(m));
      if (data?.padre_id) supabase.from("animales").select("id, caravana, categorias(nombre), razas(nombre)").eq("id", data.padre_id).single().then(({ data: p }) => setPadre(p));
      supabase.from("animales").select("id, caravana, sexo, fecha_nacimiento, categorias(nombre)").eq("madre_id", id).order("fecha_nacimiento").then(({ data: c }) => setCrias(c ?? []));
    });
    supabase.from("pesadas").select("*").eq("animal_id", id).order("fecha", { ascending: false }).then(({ data }) => setPesadas(data ?? []));
    supabase.from("sanidad").select("*").eq("animal_id", id).order("fecha", { ascending: false }).then(({ data }) => setSanidad(data ?? []));
    supabase.from("servicios").select("*").eq("vaca_id", id).order("fecha", { ascending: false }).then(({ data }) => setServicios(data ?? []));
    supabase.from("diagnosticos").select("*").eq("vaca_id", id).order("fecha", { ascending: false }).then(({ data }) => setDiags(data ?? []));
  }, [id]);

  if (!animal) return <div className="p-8">Cargando…</div>;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <Button asChild variant="ghost" size="sm"><Link to="/animales"><ArrowLeft className="h-4 w-4 mr-1" />Volver</Link></Button>

      <Card className="p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <Beef className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">Caravana {animal.caravana}</h1>
              <p className="text-muted-foreground">{animal.categorias?.nombre ?? "—"} · {animal.razas?.nombre ?? "—"} · {animal.sexo === "hembra" ? "Hembra" : "Macho"}</p>
            </div>
          </div>
          <Badge variant={animal.estado === "activo" ? "default" : "secondary"}>{animal.estado}</Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 text-sm">
          <div><div className="text-xs text-muted-foreground">Nacimiento</div><div className="font-medium">{fmtDate(animal.fecha_nacimiento)}</div></div>
          <div><div className="text-xs text-muted-foreground">Peso actual</div><div className="font-medium">{animal.peso_actual ? `${fmtNum(animal.peso_actual)} kg` : "—"}</div></div>
          <div><div className="text-xs text-muted-foreground">Estado reproductivo</div><div className="font-medium">{animal.estado_reproductivo ?? "—"}</div></div>
          <div><div className="text-xs text-muted-foreground">RFID</div><div className="font-medium">{animal.rfid ?? "—"}</div></div>
          <div><div className="text-xs text-muted-foreground">Potrero</div><div className="font-medium">{(animal as any).potrero?.nombre ?? "—"}</div></div>
        </div>
      </Card>

      <Tabs defaultValue="pesadas">
        <TabsList>
          <TabsTrigger value="pesadas">Pesadas ({pesadas.length})</TabsTrigger>
          <TabsTrigger value="sanidad">Sanidad ({sanidad.length})</TabsTrigger>
          <TabsTrigger value="repro">Reproducción ({servicios.length + diags.length})</TabsTrigger>
          <TabsTrigger value="archivos">Archivos</TabsTrigger>
          <TabsTrigger value="genealogia">Genealogía</TabsTrigger>
        </TabsList>
        <TabsContent value="pesadas"><Card className="p-4">
          {pesadas.length === 0 ? <p className="text-muted-foreground text-sm">Sin pesadas registradas.</p> : (
            <ul className="space-y-2">{pesadas.map((p) => <li key={p.id} className="flex justify-between border-b border-border pb-2 last:border-0"><span>{fmtDate(p.fecha)}</span><span className="font-medium">{fmtNum(p.peso)} kg</span></li>)}</ul>
          )}
        </Card></TabsContent>
        <TabsContent value="sanidad"><Card className="p-4">
          {sanidad.length === 0 ? <p className="text-muted-foreground text-sm">Sin tratamientos.</p> : (
            <ul className="space-y-2">{sanidad.map((s) => <li key={s.id} className="flex justify-between border-b border-border pb-2 last:border-0"><span>{fmtDate(s.fecha)} · {s.tipo}</span><span className="font-medium">{s.producto}</span></li>)}</ul>
          )}
        </Card></TabsContent>
        <TabsContent value="repro"><Card className="p-4 space-y-4">
          <div><h3 className="font-medium mb-2">Servicios</h3>
            {servicios.length === 0 ? <p className="text-muted-foreground text-sm">Sin servicios.</p> : (
              <ul className="space-y-1 text-sm">{servicios.map((s) => <li key={s.id}>{fmtDate(s.fecha)} · {s.tipo}</li>)}</ul>
            )}
          </div>
          <div><h3 className="font-medium mb-2">Diagnósticos</h3>
            {diags.length === 0 ? <p className="text-muted-foreground text-sm">Sin diagnósticos.</p> : (
              <ul className="space-y-1 text-sm">{diags.map((d) => <li key={d.id}>{fmtDate(d.fecha)} · {d.resultado ? "Preñada" : "Vacía"} {d.edad_fetal_dias ? `(${d.edad_fetal_dias}d)` : ""}</li>)}</ul>
            )}
          </div>
        </Card></TabsContent>
        <TabsContent value="archivos"><Card className="p-4">
          <Attachments entityType="animal" entityId={id} categoria="foto_animal" />
        </Card></TabsContent>

        <TabsContent value="genealogia">
          <Card className="p-6 space-y-6">
            {/* Padres */}
            <div>
              <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">Padres</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="border rounded-lg p-4">
                  <div className="text-xs text-muted-foreground mb-1">Madre</div>
                  {madre ? (
                    <a href={`/animales/${madre.id}`} className="flex items-center gap-2 hover:underline">
                      <Beef className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-mono font-semibold">{madre.caravana}</div>
                        <div className="text-xs text-muted-foreground">{madre.categorias?.nombre ?? "—"} · {madre.razas?.nombre ?? "—"}</div>
                      </div>
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">{animal.madre_id ? "Cargando…" : "No registrada"}</p>
                  )}
                </div>
                <div className="border rounded-lg p-4">
                  <div className="text-xs text-muted-foreground mb-1">Padre</div>
                  {padre ? (
                    <a href={`/animales/${padre.id}`} className="flex items-center gap-2 hover:underline">
                      <Beef className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-mono font-semibold">{padre.caravana}</div>
                        <div className="text-xs text-muted-foreground">{padre.categorias?.nombre ?? "—"} · {padre.razas?.nombre ?? "—"}</div>
                      </div>
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">{animal.padre_id ? "Cargando…" : "No registrado"}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Árbol visual simple */}
            {(madre || padre) && (
              <div className="flex flex-col items-center gap-1 py-2">
                <div className="flex gap-8 items-end">
                  <div className={`text-center px-3 py-2 rounded-lg border text-sm ${madre ? "bg-background" : "opacity-30 bg-muted"}`}>
                    <div className="text-xs text-muted-foreground">♀ Madre</div>
                    <div className="font-mono font-semibold">{madre?.caravana ?? "?"}</div>
                  </div>
                  <div className={`text-center px-3 py-2 rounded-lg border text-sm ${padre ? "bg-background" : "opacity-30 bg-muted"}`}>
                    <div className="text-xs text-muted-foreground">♂ Padre</div>
                    <div className="font-mono font-semibold">{padre?.caravana ?? "?"}</div>
                  </div>
                </div>
                <div className="flex gap-8 items-start">
                  <div className="w-px h-5 bg-border mx-auto" style={{marginLeft: "calc(50% - 1px)", width: "1px"}}></div>
                </div>
                <div className="border-2 border-primary rounded-lg px-4 py-2 text-center">
                  <div className="text-xs text-muted-foreground">{animal.sexo === "hembra" ? "♀" : "♂"}</div>
                  <div className="font-mono font-bold">{animal.caravana}</div>
                </div>
              </div>
            )}

            {/* Crías */}
            <div>
              <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">
                Crías ({crias.length})
              </h3>
              {crias.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin crías registradas.</p>
              ) : (
                <div className="space-y-2">
                  {crias.map((c) => (
                    <a key={c.id} href={`/animales/${c.id}`} className="flex items-center justify-between border rounded-lg px-4 py-2.5 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <Beef className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="font-mono font-semibold">{c.caravana}</span>
                          <span className="ml-2 text-sm text-muted-foreground">{c.categorias?.nombre ?? "—"}</span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.sexo === "macho" ? "♂" : "♀"} · {c.fecha_nacimiento ? fmtDate(c.fecha_nacimiento) : "—"}
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}