import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sprout,
  BarChart3,
  Beef,
  HeartPulse,
  Scale,
  Bot,
  MapPinned,
  Activity,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ganadero IA — Gestión ganadera profesional" },
      {
        name: "description",
        content:
          "Software ganadero integral: rodeo, reproducción, sanidad, forraje, economía e IA. Pensado para usarse en la manga.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 backdrop-blur sticky top-0 z-30 bg-background/80">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sprout className="h-4 w-4" />
            </span>
            Ganadero IA
          </div>
          <nav className="flex items-center gap-2">
            {authed ? (
              <Button asChild>
                <Link to="/dashboard">Ir al panel</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost">
                  <Link to="/auth">Iniciar sesión</Link>
                </Button>
                <Button asChild>
                  <Link to="/auth">Crear cuenta</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-6">
            <Activity className="h-3.5 w-3.5" /> Cría · Reproducción · Forraje · IA
          </span>
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight">
            La gestión del campo,{" "}
            <span className="text-primary">precisa y simple</span>.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
            Cargá tactos, vacunas, pesadas y partos desde la manga en 3
            toques. Mirá tus índices reproductivos, carga animal y balance
            forrajero en tiempo real. Preguntale a la IA cuántas vacas vacías
            tenés.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-12 px-6 text-base">
              <Link to={authed ? "/dashboard" : "/auth"}>
                {authed ? "Abrir panel" : "Empezar gratis"}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
              <Link to={authed ? "/manga" : "/auth"}>Modo manga</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24 grid md:grid-cols-3 gap-4">
        {[
          { i: Beef, t: "Rodeo trazado", d: "Animales, categorías, movimientos y genealogía con caravana única." },
          { i: HeartPulse, t: "Reproducción", d: "Servicios, tactos, pariciones, destetes e índices automáticos." },
          { i: Scale, t: "Pesadas y sanidad", d: "Carga masiva por lote, productos y costo por animal." },
          { i: MapPinned, t: "Forraje y carga", d: "EV, oferta y demanda de materia seca, receptividad por potrero." },
          { i: BarChart3, t: "Dashboard ejecutivo", d: "Stock, preñez, destete, mortalidad, margen — un solo vistazo." },
          { i: Bot, t: "IA ganadera", d: "Preguntale al sistema en lenguaje natural sobre tu rodeo." },
        ].map(({ i: Icon, t, d }) => (
          <div key={t} className="rounded-xl border border-border bg-card p-6">
            <Icon className="h-5 w-5 text-primary" />
            <h3 className="mt-4 font-semibold">{t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        Ganadero IA · Hecho para el campo argentino
      </footer>
    </div>
  );
}
