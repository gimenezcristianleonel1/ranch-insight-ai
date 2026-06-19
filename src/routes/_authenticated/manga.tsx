import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Scale, HeartPulse, Syringe, Baby, Sprout, ArrowLeftRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/manga")({
  head: () => ({ meta: [{ title: "Modo manga — Ganadero IA" }] }),
  component: MangaPage,
});

const ACTIONS = [
  { to: "/reproduccion", icon: HeartPulse, label: "Tacto", desc: "Diagnóstico de preñez", color: "bg-primary text-primary-foreground" },
  { to: "/sanidad", icon: Syringe, label: "Vacuna", desc: "Carga individual o masiva", color: "bg-accent text-accent-foreground" },
  { to: "/pesadas", icon: Scale, label: "Pesada", desc: "Caravana + peso", color: "bg-secondary text-secondary-foreground" },
  { to: "/reproduccion", icon: Baby, label: "Parición", desc: "Vaca + cría", color: "bg-chart-2/80 text-foreground" },
  { to: "/reproduccion", icon: Sprout, label: "Servicio", desc: "Vaca + toro", color: "bg-chart-3/80 text-foreground" },
  { to: "/movimientos", icon: ArrowLeftRight, label: "Movimiento", desc: "Traslado / venta", color: "bg-muted text-foreground" },
];

function MangaPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-sidebar text-sidebar-foreground p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-semibold">Modo manga</h1>
          <p className="text-sidebar-foreground/70 mt-2">Tocá una tarea para empezar. Pensado para una sola mano.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Link key={a.label} to={a.to}>
                <Card className={`${a.color} p-8 h-44 flex flex-col items-center justify-center text-center hover:scale-[1.02] transition-transform border-0`}>
                  <Icon className="h-12 w-12 mb-3" />
                  <div className="text-2xl font-semibold">{a.label}</div>
                  <div className="text-xs opacity-80 mt-1">{a.desc}</div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}