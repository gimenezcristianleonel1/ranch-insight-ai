import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEstablecimiento } from "@/hooks/use-establecimiento";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";
import { ConfirmDelete } from "@/components/confirm";
import { CheckCircle2, ChevronLeft, ChevronRight, Plus, CalendarClock, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/planificacion")({
  head: () => ({ meta: [{ title: "Planificación — GanaderIA" }] }),
  component: PlanPage,
});

type Tarea = {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  hora: string | null;
  prioridad: "baja" | "media" | "alta" | "urgente";
  categoria: string | null;
  responsable: string | null;
  estado: "pendiente" | "en_progreso" | "completada" | "cancelada";
  observaciones: string | null;
  animal_id: string | null;
  potrero_id: string | null;
  sanidad_id: string | null;
  servicio_id: string | null;
  completada_at: string | null;
};

const CATEGORIAS = ["Sanidad", "Reproducción", "Manejo", "Pastoreo", "Infraestructura", "Administración", "Otros"];

const PRIORIDAD_STYLE: Record<string, string> = {
  baja: "bg-muted text-muted-foreground",
  media: "bg-primary/15 text-primary",
  alta: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  urgente: "bg-destructive/15 text-destructive",
};

function todayISO() { return new Date().toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfWeek(d: Date) { const r = new Date(d); const wd = (r.getDay() + 6) % 7; r.setDate(r.getDate() - wd); r.setHours(0,0,0,0); return r; }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function isoDate(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }

function PlanPage() {
  const { activeId, active } = useActiveEstablecimiento();
  if (!active) return <div className="p-8">Seleccioná un establecimiento.</div>;
  return <PlanInner estId={activeId!} />;
}

function PlanInner({ estId }: { estId: string }) {
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [refs, setRefs] = useState<{ animales: any[]; potreros: any[]; sanidad: any[]; servicios: any[] }>({ animales: [], potreros: [], sanidad: [], servicios: [] });

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("tareas")
      .select("*")
      .eq("establecimiento_id", estId)
      .order("fecha", { ascending: true })
      .order("hora", { ascending: true, nullsFirst: true });
    setTareas((data ?? []) as Tarea[]);
    setLoading(false);
  }

  async function loadRefs() {
    const [a, p, s, sv] = await Promise.all([
      supabase.from("animales").select("id, caravana").eq("establecimiento_id", estId).limit(500),
      supabase.from("potreros").select("id, nombre").eq("establecimiento_id", estId),
      supabase.from("sanidad").select("id, producto, fecha").eq("establecimiento_id", estId).order("fecha", { ascending: false }).limit(100),
      supabase.from("servicios").select("id, tipo, fecha_inicio").eq("establecimiento_id", estId).order("fecha_inicio", { ascending: false }).limit(100),
    ]);
    setRefs({ animales: a.data ?? [], potreros: p.data ?? [], sanidad: s.data ?? [], servicios: sv.data ?? [] });
  }

  useEffect(() => { load(); loadRefs(); }, [estId]);

  // Recordatorios automáticos al cargar
  useEffect(() => {
    if (loading) return;
    const hoy = todayISO();
    const en3 = isoDate(addDays(new Date(), 3));
    const vencidas = tareas.filter((t) => t.estado !== "completada" && t.estado !== "cancelada" && t.fecha < hoy);
    const proximas = tareas.filter((t) => t.estado !== "completada" && t.estado !== "cancelada" && t.fecha >= hoy && t.fecha <= en3);
    if (vencidas.length) toast.warning(`${vencidas.length} tarea${vencidas.length>1?"s":""} vencida${vencidas.length>1?"s":""}`, { id: "v-warn" });
    if (proximas.length) toast.info(`${proximas.length} tarea${proximas.length>1?"s":""} en los próximos 3 días`, { id: "p-info" });
  }, [loading]);

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold">Planificación</h1>
          <p className="text-muted-foreground text-sm">Calendario de tareas del campo.</p>
        </div>
        <TareaDialog estId={estId} refs={refs} onSaved={load}>
          <Button size="lg" className="h-12"><Plus className="h-5 w-5 mr-1" /> Nueva tarea</Button>
        </TareaDialog>
      </div>

      <KPIs tareas={tareas} />

      <Tabs defaultValue="mes">
        <TabsList className="grid grid-cols-4 w-full max-w-md">
          <TabsTrigger value="dia">Día</TabsTrigger>
          <TabsTrigger value="semana">Semana</TabsTrigger>
          <TabsTrigger value="mes">Mes</TabsTrigger>
          <TabsTrigger value="lista">Lista</TabsTrigger>
        </TabsList>
        <TabsContent value="dia"><VistaDia tareas={tareas} estId={estId} refs={refs} onSaved={load} /></TabsContent>
        <TabsContent value="semana"><VistaSemana tareas={tareas} estId={estId} refs={refs} onSaved={load} /></TabsContent>
        <TabsContent value="mes"><VistaMes tareas={tareas} estId={estId} refs={refs} onSaved={load} /></TabsContent>
        <TabsContent value="lista"><VistaLista tareas={tareas} estId={estId} refs={refs} onSaved={load} /></TabsContent>
      </Tabs>
    </div>
  );
}

function KPIs({ tareas }: { tareas: Tarea[] }) {
  const hoy = todayISO();
  const sow = startOfWeek(new Date()); const eow = addDays(sow, 6);
  const k = useMemo(() => {
    let pend = 0, venc = 0, comp = 0, semana = 0;
    for (const t of tareas) {
      if (t.estado === "completada") comp++;
      else if (t.estado !== "cancelada") {
        pend++;
        if (t.fecha < hoy) venc++;
      }
      if (t.fecha >= isoDate(sow) && t.fecha <= isoDate(eow)) semana++;
    }
    return { pend, venc, comp, semana };
  }, [tareas]);
  const cards = [
    { label: "Pendientes", value: k.pend, icon: CalendarClock, tone: "text-primary" },
    { label: "Vencidas", value: k.venc, icon: AlertTriangle, tone: "text-destructive" },
    { label: "Completadas", value: k.comp, icon: CheckCircle2, tone: "text-emerald-600" },
    { label: "Esta semana", value: k.semana, icon: CalendarClock, tone: "text-foreground" },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.label} className="p-4 flex items-center gap-3">
            <Icon className={`h-6 w-6 ${c.tone}`} />
            <div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
              <div className="text-2xl font-semibold tabular-nums">{c.value}</div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function TareaItem({ t, onSaved, estId, refs }: { t: Tarea; onSaved: () => void; estId: string; refs: any }) {
  async function toggle(checked: boolean) {
    const { error } = await supabase.from("tareas").update({
      estado: checked ? "completada" : "pendiente",
      completada_at: checked ? new Date().toISOString() : null,
    }).eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success(checked ? "Tarea completada" : "Tarea reabierta");
    onSaved();
  }
  async function del() {
    const { error } = await supabase.from("tareas").delete().eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Eliminada"); onSaved();
  }
  const hoy = todayISO();
  const vencida = t.estado !== "completada" && t.estado !== "cancelada" && t.fecha < hoy;
  return (
    <div className={`flex items-start gap-2 py-2 ${t.estado === "completada" ? "opacity-60" : ""}`}>
      <Checkbox checked={t.estado === "completada"} onCheckedChange={(c) => toggle(!!c)} className="mt-1" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-medium ${t.estado === "completada" ? "line-through" : ""}`}>{t.titulo}</span>
          <Badge variant="secondary" className={PRIORIDAD_STYLE[t.prioridad]}>{t.prioridad}</Badge>
          {t.categoria && <Badge variant="outline">{t.categoria}</Badge>}
          {vencida && <Badge variant="destructive">Vencida</Badge>}
        </div>
        <div className="text-xs text-muted-foreground">
          {fmtDate(t.fecha)}{t.hora ? ` · ${t.hora.slice(0,5)}` : ""}{t.responsable ? ` · ${t.responsable}` : ""}
        </div>
        {t.descripcion && <div className="text-sm text-muted-foreground mt-1">{t.descripcion}</div>}
      </div>
      <TareaDialog estId={estId} refs={refs} onSaved={onSaved} initial={t}>
        <Button variant="ghost" size="sm">Editar</Button>
      </TareaDialog>
      <ConfirmDelete onConfirm={del} />
    </div>
  );
}

function VistaLista({ tareas, estId, refs, onSaved }: any) {
  const grupos = useMemo(() => {
    const map = new Map<string, Tarea[]>();
    for (const t of tareas as Tarea[]) {
      if (!map.has(t.fecha)) map.set(t.fecha, []);
      map.get(t.fecha)!.push(t);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [tareas]);
  return (
    <Card className="p-4 mt-4 divide-y">
      {grupos.length === 0 && <div className="text-muted-foreground text-sm py-2">Sin tareas.</div>}
      {grupos.map(([fecha, items]) => (
        <div key={fecha} className="py-2">
          <div className="text-xs uppercase text-muted-foreground font-semibold mb-1">{fmtDate(fecha)}</div>
          {items.map((t) => <TareaItem key={t.id} t={t} estId={estId} refs={refs} onSaved={onSaved} />)}
        </div>
      ))}
    </Card>
  );
}

function VistaDia({ tareas, estId, refs, onSaved }: any) {
  const [d, setD] = useState(new Date());
  const iso = isoDate(d);
  const items = (tareas as Tarea[]).filter((t) => t.fecha === iso);
  return (
    <Card className="p-4 mt-4">
      <Nav title={fmtDate(iso)} onPrev={() => setD(addDays(d,-1))} onNext={() => setD(addDays(d,1))} onToday={() => setD(new Date())} />
      <div className="divide-y mt-3">
        {items.length === 0 && <div className="text-muted-foreground text-sm py-2">Sin tareas para este día.</div>}
        {items.map((t) => <TareaItem key={t.id} t={t} estId={estId} refs={refs} onSaved={onSaved} />)}
      </div>
    </Card>
  );
}

function VistaSemana({ tareas, estId, refs, onSaved }: any) {
  const [base, setBase] = useState(startOfWeek(new Date()));
  const days = Array.from({ length: 7 }, (_, i) => addDays(base, i));
  return (
    <Card className="p-4 mt-4">
      <Nav title={`${fmtDate(isoDate(base))} – ${fmtDate(isoDate(addDays(base,6)))}`} onPrev={() => setBase(addDays(base,-7))} onNext={() => setBase(addDays(base,7))} onToday={() => setBase(startOfWeek(new Date()))} />
      <div className="grid md:grid-cols-7 gap-2 mt-3">
        {days.map((d) => {
          const iso = isoDate(d);
          const items = (tareas as Tarea[]).filter((t) => t.fecha === iso);
          const isToday = iso === todayISO();
          return (
            <div key={iso} className={`border rounded-md p-2 min-h-[120px] ${isToday ? "border-primary" : "border-border"}`}>
              <div className="text-xs font-semibold mb-1">{d.toLocaleDateString("es", { weekday: "short", day: "numeric" })}</div>
              <div className="space-y-1">
                {items.map((t) => (
                  <TareaDialog key={t.id} estId={estId} refs={refs} onSaved={onSaved} initial={t}>
                    <button className={`w-full text-left text-xs px-2 py-1 rounded ${PRIORIDAD_STYLE[t.prioridad]} truncate ${t.estado === "completada" ? "line-through opacity-60" : ""}`}>
                      {t.hora ? `${t.hora.slice(0,5)} ` : ""}{t.titulo}
                    </button>
                  </TareaDialog>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function VistaMes({ tareas, estId, refs, onSaved }: any) {
  const [base, setBase] = useState(startOfMonth(new Date()));
  const first = startOfMonth(base);
  const last = endOfMonth(base);
  const gridStart = startOfWeek(first);
  const daysCount = Math.ceil((((last.getTime() - gridStart.getTime()) / 86400000) + 1) / 7) * 7;
  const days = Array.from({ length: daysCount }, (_, i) => addDays(gridStart, i));
  return (
    <Card className="p-4 mt-4">
      <Nav title={base.toLocaleDateString("es", { month: "long", year: "numeric" })} onPrev={() => setBase(new Date(base.getFullYear(), base.getMonth()-1, 1))} onNext={() => setBase(new Date(base.getFullYear(), base.getMonth()+1, 1))} onToday={() => setBase(startOfMonth(new Date()))} />
      <div className="grid grid-cols-7 gap-1 text-[10px] uppercase text-muted-foreground font-semibold mt-3">
        {["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map((d) => <div key={d} className="px-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1 mt-1">
        {days.map((d) => {
          const iso = isoDate(d);
          const items = (tareas as Tarea[]).filter((t) => t.fecha === iso);
          const otherMonth = d.getMonth() !== base.getMonth();
          const isToday = iso === todayISO();
          return (
            <div key={iso} className={`border rounded p-1 min-h-[70px] text-xs ${otherMonth ? "opacity-40" : ""} ${isToday ? "border-primary" : "border-border"}`}>
              <div className="font-semibold">{d.getDate()}</div>
              <div className="space-y-0.5 mt-0.5">
                {items.slice(0,3).map((t) => (
                  <TareaDialog key={t.id} estId={estId} refs={refs} onSaved={onSaved} initial={t}>
                    <button className={`w-full text-left px-1 rounded truncate ${PRIORIDAD_STYLE[t.prioridad]} ${t.estado === "completada" ? "line-through opacity-60" : ""}`}>
                      {t.titulo}
                    </button>
                  </TareaDialog>
                ))}
                {items.length > 3 && <div className="text-muted-foreground">+{items.length - 3}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Nav({ title, onPrev, onNext, onToday }: { title: string; onPrev: () => void; onNext: () => void; onToday: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Button variant="outline" size="icon" onClick={onPrev}><ChevronLeft className="h-4 w-4" /></Button>
      <div className="flex items-center gap-2">
        <span className="font-semibold capitalize">{title}</span>
        <Button variant="ghost" size="sm" onClick={onToday}>Hoy</Button>
      </div>
      <Button variant="outline" size="icon" onClick={onNext}><ChevronRight className="h-4 w-4" /></Button>
    </div>
  );
}

function TareaDialog({ children, estId, refs, onSaved, initial }: { children: React.ReactNode; estId: string; refs: any; onSaved: () => void; initial?: Tarea }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    titulo: initial?.titulo ?? "",
    descripcion: initial?.descripcion ?? "",
    fecha: initial?.fecha ?? todayISO(),
    hora: initial?.hora ?? "",
    prioridad: initial?.prioridad ?? "media",
    categoria: initial?.categoria ?? "",
    responsable: initial?.responsable ?? "",
    estado: initial?.estado ?? "pendiente",
    observaciones: initial?.observaciones ?? "",
    animal_id: initial?.animal_id ?? "",
    potrero_id: initial?.potrero_id ?? "",
    sanidad_id: initial?.sanidad_id ?? "",
    servicio_id: initial?.servicio_id ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.titulo.trim()) return toast.error("Falta el título");
    setSaving(true);
    const payload: any = {
      establecimiento_id: estId,
      titulo: f.titulo.trim(),
      descripcion: f.descripcion || null,
      fecha: f.fecha,
      hora: f.hora || null,
      prioridad: f.prioridad,
      categoria: f.categoria || null,
      responsable: f.responsable || null,
      estado: f.estado,
      observaciones: f.observaciones || null,
      animal_id: f.animal_id || null,
      potrero_id: f.potrero_id || null,
      sanidad_id: f.sanidad_id || null,
      servicio_id: f.servicio_id || null,
      completada_at: f.estado === "completada" ? (initial?.completada_at ?? new Date().toISOString()) : null,
    };
    const q = initial ? supabase.from("tareas").update(payload).eq("id", initial.id) : supabase.from("tareas").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(initial ? "Tarea actualizada" : "Tarea creada");
    setOpen(false); onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "Editar tarea" : "Nueva tarea"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Título *</Label><Input autoFocus required value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} className="h-11" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Fecha *</Label><Input type="date" required value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} className="h-11" /></div>
            <div><Label>Hora</Label><Input type="time" value={f.hora} onChange={(e) => setF({ ...f, hora: e.target.value })} className="h-11" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Prioridad</Label>
              <Select value={f.prioridad} onValueChange={(v) => setF({ ...f, prioridad: v as any })}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">Baja</SelectItem><SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem><SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Categoría</Label>
              <Select value={f.categoria || "_"} onValueChange={(v) => setF({ ...f, categoria: v === "_" ? "" : v })}>
                <SelectTrigger className="h-11"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">—</SelectItem>
                  {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Responsable</Label><Input value={f.responsable} onChange={(e) => setF({ ...f, responsable: e.target.value })} /></div>
            <div><Label>Estado</Label>
              <Select value={f.estado} onValueChange={(v) => setF({ ...f, estado: v as any })}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="en_progreso">En progreso</SelectItem>
                  <SelectItem value="completada">Completada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Descripción</Label><Textarea rows={2} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></div>

          <div className="border-t pt-3">
            <div className="text-xs font-semibold text-muted-foreground mb-2">Relacionar (opcional)</div>
            <div className="grid grid-cols-2 gap-3">
              <RefSelect label="Animal" value={f.animal_id} onChange={(v) => setF({ ...f, animal_id: v })} options={refs.animales.map((a: any) => ({ id: a.id, label: a.caravana }))} />
              <RefSelect label="Potrero" value={f.potrero_id} onChange={(v) => setF({ ...f, potrero_id: v })} options={refs.potreros.map((p: any) => ({ id: p.id, label: p.nombre }))} />
              <RefSelect label="Sanidad" value={f.sanidad_id} onChange={(v) => setF({ ...f, sanidad_id: v })} options={refs.sanidad.map((s: any) => ({ id: s.id, label: `${s.producto} · ${s.fecha}` }))} />
              <RefSelect label="Servicio" value={f.servicio_id} onChange={(v) => setF({ ...f, servicio_id: v })} options={refs.servicios.map((s: any) => ({ id: s.id, label: `${s.tipo} · ${s.fecha_inicio}` }))} />
            </div>
          </div>

          <div><Label>Observaciones</Label><Textarea rows={2} value={f.observaciones} onChange={(e) => setF({ ...f, observaciones: e.target.value })} /></div>

          <DialogFooter>
            <Button type="submit" disabled={saving} className="w-full h-12">{saving ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RefSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { id: string; label: string }[] }) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value || "_"} onValueChange={(v) => onChange(v === "_" ? "" : v)}>
        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="_">—</SelectItem>
          {options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}