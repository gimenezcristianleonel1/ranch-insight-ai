import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEstablecimiento } from "@/hooks/use-establecimiento";
import { Card } from "@/components/ui/card";
import { ScrollText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/auditoria")({
  head: () => ({ meta: [{ title: "Auditoría — Ganadero IA" }] }),
  component: AuditoriaPage,
});

type Row = { id: string; accion: string; entidad: string; entidad_id: string | null; detalle: unknown; created_at: string; user_id: string | null };

function AuditoriaPage() {
  const { activeId } = useActiveEstablecimiento();
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    if (!activeId) return;
    supabase.from("auditoria").select("*").eq("establecimiento_id", activeId)
      .order("created_at", { ascending: false }).limit(300)
      .then(({ data }) => setRows((data as Row[]) ?? []));
  }, [activeId]);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ScrollText className="h-6 w-6 text-primary" /> Auditoría</h1>
        <p className="text-muted-foreground text-sm">Últimas 300 acciones registradas en el sistema.</p>
      </div>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30"><tr className="text-left"><th className="px-4 py-2">Fecha</th><th>Acción</th><th>Entidad</th><th>Detalle</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border/50">
                <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td className="font-medium">{r.accion}</td>
                <td className="text-muted-foreground">{r.entidad}</td>
                <td className="text-xs font-mono text-muted-foreground truncate max-w-md">{r.detalle ? JSON.stringify(r.detalle) : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="py-10 text-center text-muted-foreground">Sin actividad registrada todavía.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}