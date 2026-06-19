import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEstablecimiento } from "@/hooks/use-establecimiento";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { fmtNum } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/finanzas")({
  head: () => ({ meta: [{ title: "Finanzas — Ganadero IA" }] }),
  component: FinanzasPage,
});

type Cat = { id: string; nombre: string; tipo: "ingreso" | "egreso" };
type Mov = { id: string; fecha: string; tipo: "ingreso" | "egreso"; concepto: string; monto: number; moneda: string; categoria_id: string | null };

function FinanzasPage() {
  const { activeId } = useActiveEstablecimiento();
  const [cats, setCats] = useState<Cat[]>([]);
  const [movs, setMovs] = useState<Mov[]>([]);
  const [openCat, setOpenCat] = useState(false);
  const [openMov, setOpenMov] = useState(false);
  const [newCat, setNewCat] = useState({ nombre: "", tipo: "egreso" as "ingreso" | "egreso" });
  const [form, setForm] = useState({ tipo: "egreso" as "ingreso" | "egreso", categoria_id: "", concepto: "", monto: "", moneda: "ARS", fecha: new Date().toISOString().slice(0, 10) });

  async function load() {
    if (!activeId) return;
    const [{ data: c }, { data: m }] = await Promise.all([
      supabase.from("finanzas_categorias").select("*").eq("establecimiento_id", activeId).order("nombre"),
      supabase.from("finanzas_movimientos").select("*").eq("establecimiento_id", activeId).order("fecha", { ascending: false }).limit(200),
    ]);
    setCats((c as Cat[]) ?? []);
    setMovs((m as Mov[]) ?? []);
  }
  useEffect(() => { load(); }, [activeId]);

  async function saveCat(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId) return;
    const { error } = await supabase.from("finanzas_categorias").insert({ establecimiento_id: activeId, ...newCat });
    if (error) return toast.error(error.message);
    toast.success("Categoría creada"); setOpenCat(false); setNewCat({ nombre: "", tipo: "egreso" }); load();
  }
  async function saveMov(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("finanzas_movimientos").insert({
      establecimiento_id: activeId, tipo: form.tipo, categoria_id: form.categoria_id || null,
      concepto: form.concepto, monto: Number(form.monto), moneda: form.moneda, fecha: form.fecha, user_id: u.user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Movimiento registrado"); setOpenMov(false);
    setForm({ ...form, concepto: "", monto: "" }); load();
  }

  const ingresos = movs.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + Number(m.monto), 0);
  const egresos = movs.filter((m) => m.tipo === "egreso").reduce((s, m) => s + Number(m.monto), 0);
  const catName = (id: string | null) => cats.find((c) => c.id === id)?.nombre ?? "—";

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Finanzas</h1>
          <p className="text-muted-foreground text-sm">Ingresos y egresos del establecimiento.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={openCat} onOpenChange={setOpenCat}>
            <DialogTrigger asChild><Button variant="outline">Categorías</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nueva categoría</DialogTitle></DialogHeader>
              <form onSubmit={saveCat} className="space-y-3">
                <div><Label>Nombre</Label><Input required value={newCat.nombre} onChange={(e) => setNewCat({ ...newCat, nombre: e.target.value })} /></div>
                <div><Label>Tipo</Label>
                  <Select value={newCat.tipo} onValueChange={(v) => setNewCat({ ...newCat, tipo: v as "ingreso" | "egreso" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="ingreso">Ingreso</SelectItem><SelectItem value="egreso">Egreso</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="text-xs text-muted-foreground">Existentes: {cats.map((c) => `${c.nombre} (${c.tipo})`).join(", ") || "—"}</div>
                <DialogFooter><Button type="submit">Guardar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={openMov} onOpenChange={setOpenMov}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Movimiento</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuevo movimiento</DialogTitle></DialogHeader>
              <form onSubmit={saveMov} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Tipo</Label>
                    <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as "ingreso" | "egreso", categoria_id: "" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="ingreso">Ingreso</SelectItem><SelectItem value="egreso">Egreso</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label>Fecha</Label><Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></div>
                </div>
                <div><Label>Categoría</Label>
                  <Select value={form.categoria_id} onValueChange={(v) => setForm({ ...form, categoria_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                    <SelectContent>{cats.filter((c) => c.tipo === form.tipo).map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Concepto</Label><Input required value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Monto</Label><Input type="number" step="0.01" required value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} /></div>
                  <div><Label>Moneda</Label>
                    <Select value={form.moneda} onValueChange={(v) => setForm({ ...form, moneda: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="ARS">ARS</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button type="submit">Guardar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4"><div className="flex items-center justify-between"><div><div className="text-xs text-muted-foreground">Ingresos</div><div className="text-2xl font-bold text-primary mt-1">${fmtNum(ingresos, 0)}</div></div><TrendingUp className="h-8 w-8 text-primary" /></div></Card>
        <Card className="p-4"><div className="flex items-center justify-between"><div><div className="text-xs text-muted-foreground">Egresos</div><div className="text-2xl font-bold text-destructive mt-1">${fmtNum(egresos, 0)}</div></div><TrendingDown className="h-8 w-8 text-destructive" /></div></Card>
        <Card className="p-4"><div className="flex items-center justify-between"><div><div className="text-xs text-muted-foreground">Resultado</div><div className="text-2xl font-bold mt-1">${fmtNum(ingresos - egresos, 0)}</div></div><Wallet className="h-8 w-8 text-muted-foreground" /></div></Card>
      </div>

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Movimientos recientes</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground border-b border-border"><th className="py-2">Fecha</th><th>Tipo</th><th>Categoría</th><th>Concepto</th><th className="text-right">Monto</th></tr></thead>
            <tbody>
              {movs.map((m) => (
                <tr key={m.id} className="border-b border-border/50">
                  <td className="py-2">{m.fecha}</td>
                  <td><span className={m.tipo === "ingreso" ? "text-primary" : "text-destructive"}>{m.tipo}</span></td>
                  <td>{catName(m.categoria_id)}</td>
                  <td>{m.concepto}</td>
                  <td className="text-right font-medium">{m.moneda} {fmtNum(m.monto, 2)}</td>
                </tr>
              ))}
              {movs.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Sin movimientos</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}