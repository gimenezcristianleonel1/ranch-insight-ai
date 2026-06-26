import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEstablecimiento } from "@/hooks/use-establecimiento";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Scale, HeartPulse, Syringe, Baby, ArrowLeftRight,
  Beef, CheckCircle2, ChevronLeft, AlertCircle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/manga")({
  head: () => ({ meta: [{ title: "Manga — Ganadero IA" }] }),
  component: MangaPage,
});

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Accion = "pesada" | "tacto" | "sanidad" | "traslado" | "paricion" | "destete";

type Animal = {
  id: string; caravana: string; sexo: string;
  peso_actual: number | null; estado_reproductivo: string | null;
  categoria: { nombre: string } | null;
  potrero: { nombre: string } | null;
};

// ─── Colores y labels por acción ─────────────────────────────────────────────

const ACCIONES: { id: Accion; icon: any; label: string; desc: string; color: string; bg: string }[] = [
  { id: "tacto",    icon: HeartPulse,    label: "Tacto",     desc: "Diagnóstico preñez",  color: "text-rose-100",    bg: "bg-rose-600" },
  { id: "pesada",   icon: Scale,         label: "Pesada",    desc: "Caravana + peso",      color: "text-blue-100",    bg: "bg-blue-600" },
  { id: "sanidad",  icon: Syringe,       label: "Sanidad",   desc: "Vacuna / tratamiento", color: "text-emerald-100", bg: "bg-emerald-700" },
  { id: "traslado", icon: ArrowLeftRight, label: "Traslado",  desc: "Mover de potrero",     color: "text-amber-100",   bg: "bg-amber-600" },
  { id: "paricion", icon: Baby,          label: "Parición",  desc: "Vaca + cría",          color: "text-purple-100",  bg: "bg-purple-700" },
  { id: "destete",  icon: Beef,          label: "Destete",   desc: "Separar cría",         color: "text-orange-100",  bg: "bg-orange-600" },
];

// ─── Hook para buscar animal ──────────────────────────────────────────────────

function useAnimal(estId: string) {
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const buscar = useCallback(async (caravana: string) => {
    if (!caravana.trim()) return;
    setLoading(true); setNotFound(false); setAnimal(null);
    const { data } = await supabase
      .from("animales")
      .select("id, caravana, sexo, peso_actual, estado_reproductivo, categoria:categorias(nombre), potrero:potreros(nombre)")
      .eq("establecimiento_id", estId)
      .ilike("caravana", caravana.trim())
      .eq("estado", "activo")
      .maybeSingle();
    setLoading(false);
    if (data) setAnimal(data as any);
    else setNotFound(true);
  }, [estId]);

  const reset = () => { setAnimal(null); setNotFound(false); };
  return { animal, loading, notFound, buscar, reset };
}

// ─── Pantalla principal: selector de acción ───────────────────────────────────

function MangaPage() {
  const { activeId, active } = useActiveEstablecimiento();
  const [accion, setAccion] = useState<Accion | null>(null);

  if (!active) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white p-6">
      <p className="text-xl">Seleccioná un establecimiento primero.</p>
    </div>
  );

  if (accion) {
    return (
      <AccionScreen
        accion={accion}
        estId={activeId!}
        estNombre={active.nombre}
        onBack={() => setAccion(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 flex flex-col">
      <div className="text-center pt-6 pb-8">
        <p className="text-gray-400 text-sm uppercase tracking-widest mb-1">Modo manga</p>
        <h1 className="text-4xl font-bold">{active.nombre}</h1>
        <p className="text-gray-500 text-sm mt-2">Seleccioná una acción</p>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto w-full flex-1">
        {ACCIONES.map(a => {
          const Icon = a.icon;
          return (
            <button
              key={a.id}
              onClick={() => setAccion(a.id)}
              className={`${a.bg} rounded-2xl p-6 flex flex-col items-center justify-center gap-3 active:scale-95 transition-transform min-h-[140px]`}
            >
              <Icon className={`h-10 w-10 ${a.color}`} />
              <div className="text-center">
                <div className={`text-xl font-bold ${a.color}`}>{a.label}</div>
                <div className={`text-xs ${a.color} opacity-70 mt-0.5`}>{a.desc}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Pantalla de acción ───────────────────────────────────────────────────────

function AccionScreen({ accion, estId, estNombre, onBack }: {
  accion: Accion; estId: string; estNombre: string; onBack: () => void;
}) {
  const cfg = ACCIONES.find(a => a.id === accion)!;
  const Icon = cfg.icon;
  const [caravana, setCaravana] = useState("");
  const { animal, loading, notFound, buscar, reset } = useAnimal(estId);
  const [guardado, setGuardado] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCaravana = (e: React.FormEvent) => {
    e.preventDefault();
    buscar(caravana);
  };

  const resetTodo = () => {
    setCaravana(""); reset(); setGuardado(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className={`${cfg.bg} px-4 py-4 flex items-center gap-3`}>
        <button onClick={onBack} className="p-2 rounded-full bg-black/20 active:bg-black/40">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <Icon className="h-6 w-6" />
        <div>
          <div className="text-xl font-bold">{cfg.label}</div>
          <div className="text-xs opacity-70">{estNombre}</div>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4 max-w-sm mx-auto w-full">

        {/* Input caravana */}
        {!animal && !guardado && (
          <form onSubmit={handleCaravana} className="space-y-3">
            <label className="text-gray-400 text-sm uppercase tracking-wider">Caravana</label>
            <Input
              ref={inputRef}
              autoFocus
              value={caravana}
              onChange={e => setCaravana(e.target.value)}
              placeholder="Ej: 1023"
              className="h-20 text-4xl font-mono text-center bg-gray-800 border-gray-700 text-white placeholder:text-gray-600 rounded-2xl"
            />
            {notFound && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="h-4 w-4" />
                Caravana "{caravana}" no encontrada en el rodeo
              </div>
            )}
            <Button
              type="submit"
              disabled={loading || !caravana.trim()}
              className="w-full h-14 text-xl rounded-2xl bg-white text-gray-900 hover:bg-gray-100"
            >
              {loading ? "Buscando…" : "Buscar →"}
            </Button>
          </form>
        )}

        {/* Ficha animal encontrado */}
        {animal && !guardado && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-4xl font-mono font-bold">{animal.caravana}</span>
                <button onClick={resetTodo} className="text-gray-500 text-xs underline">cambiar</button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{animal.categoria?.nombre ?? "—"}</Badge>
                <Badge variant="outline">{animal.sexo === "macho" ? "♂ Macho" : "♀ Hembra"}</Badge>
                {animal.potrero && <Badge variant="outline">📍 {animal.potrero.nombre}</Badge>}
                {animal.estado_reproductivo && (
                  <Badge variant="outline" className="capitalize">{animal.estado_reproductivo}</Badge>
                )}
              </div>
              {animal.peso_actual && (
                <p className="text-gray-400 text-sm">Último peso: <strong className="text-white">{animal.peso_actual} kg</strong></p>
              )}
            </div>

            {/* Form específico de cada acción */}
            {accion === "pesada"   && <PesadaForm animal={animal} estId={estId} onGuardado={() => { setGuardado(true); }} />}
            {accion === "tacto"    && <TactoForm  animal={animal} estId={estId} onGuardado={() => { setGuardado(true); }} />}
            {accion === "sanidad"  && <SanidadForm animal={animal} estId={estId} onGuardado={() => { setGuardado(true); }} />}
            {accion === "traslado" && <TrasladoForm animal={animal} estId={estId} onGuardado={() => { setGuardado(true); }} />}
            {accion === "paricion" && <ParicionForm animal={animal} estId={estId} onGuardado={() => { setGuardado(true); }} />}
            {accion === "destete"  && <DesteteFormManga animal={animal} estId={estId} onGuardado={() => { setGuardado(true); }} />}
          </div>
        )}

        {/* Confirmación guardado */}
        {guardado && (
          <div className="flex flex-col items-center justify-center gap-6 py-10">
            <CheckCircle2 className="h-24 w-24 text-emerald-400" />
            <p className="text-2xl font-bold text-emerald-400">¡Guardado!</p>
            <p className="text-gray-400 text-center">Caravana {animal?.caravana}</p>
            <Button
              onClick={resetTodo}
              className="w-full h-16 text-xl rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              Siguiente animal →
            </Button>
            <button onClick={onBack} className="text-gray-500 text-sm underline">
              Volver al menú
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Forms por acción ─────────────────────────────────────────────────────────

function PesadaForm({ animal, estId, onGuardado }: { animal: Animal; estId: string; onGuardado: () => void }) {
  const [peso, setPeso] = useState("");
  const [saving, setSaving] = useState(false);
  const fecha = new Date().toISOString().slice(0, 10);

  async function guardar() {
    if (!peso || isNaN(Number(peso))) { toast.error("Ingresá un peso válido"); return; }
    setSaving(true);
    const { error } = await supabase.from("pesadas").insert({
      establecimiento_id: estId, animal_id: animal.id,
      peso: Number(peso), fecha,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    onGuardado();
  }

  return (
    <div className="space-y-3">
      <label className="text-gray-400 text-sm uppercase tracking-wider">Peso (kg)</label>
      <Input
        autoFocus type="number" step="0.5" inputMode="decimal"
        value={peso} onChange={e => setPeso(e.target.value)}
        placeholder="000"
        className="h-24 text-5xl font-mono text-center bg-gray-800 border-gray-700 text-white placeholder:text-gray-600 rounded-2xl"
      />
      <Button onClick={guardar} disabled={saving || !peso} className="w-full h-16 text-2xl rounded-2xl bg-blue-600 hover:bg-blue-500">
        {saving ? "Guardando…" : `✓ ${peso ? peso + " kg" : "Guardar"}`}
      </Button>
    </div>
  );
}

function TactoForm({ animal, estId, onGuardado }: { animal: Animal; estId: string; onGuardado: () => void }) {
  const [resultado, setResultado] = useState<"pos" | "neg" | null>(null);
  const [edad, setEdad] = useState("60");
  const [saving, setSaving] = useState(false);
  const fecha = new Date().toISOString().slice(0, 10);

  async function guardar() {
    if (!resultado) { toast.error("Seleccioná el resultado"); return; }
    setSaving(true);
    const { error } = await supabase.from("diagnosticos").insert({
      establecimiento_id: estId, vaca_id: animal.id,
      resultado: resultado === "pos",
      edad_fetal_dias: resultado === "pos" ? Number(edad) : null, fecha,
    });
    if (!error) {
      await supabase.from("animales").update({
        estado_reproductivo: resultado === "pos" ? "prenada" : "vacia"
      }).eq("id", animal.id);
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    onGuardado();
  }

  return (
    <div className="space-y-4">
      <label className="text-gray-400 text-sm uppercase tracking-wider">Resultado</label>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setResultado("pos")}
          className={`h-24 rounded-2xl text-2xl font-bold transition-all ${resultado === "pos" ? "bg-emerald-600 text-white scale-105" : "bg-gray-800 text-gray-300"}`}
        >
          ✓ Preñada
        </button>
        <button
          onClick={() => setResultado("neg")}
          className={`h-24 rounded-2xl text-2xl font-bold transition-all ${resultado === "neg" ? "bg-red-600 text-white scale-105" : "bg-gray-800 text-gray-300"}`}
        >
          ✗ Vacía
        </button>
      </div>

      {resultado === "pos" && (
        <div className="space-y-2">
          <label className="text-gray-400 text-sm uppercase tracking-wider">Edad fetal (días)</label>
          <div className="grid grid-cols-4 gap-2">
            {["30","60","90","120"].map(d => (
              <button key={d}
                onClick={() => setEdad(d)}
                className={`h-14 rounded-xl text-xl font-bold ${edad === d ? "bg-white text-gray-900" : "bg-gray-800 text-gray-300"}`}
              >{d}</button>
            ))}
          </div>
        </div>
      )}

      <Button
        onClick={guardar} disabled={saving || !resultado}
        className={`w-full h-16 text-2xl rounded-2xl ${resultado === "pos" ? "bg-emerald-600 hover:bg-emerald-500" : resultado === "neg" ? "bg-red-600 hover:bg-red-500" : "bg-gray-700"}`}
      >
        {saving ? "Guardando…" : "✓ Guardar tacto"}
      </Button>
    </div>
  );
}

function SanidadForm({ animal, estId, onGuardado }: { animal: Animal; estId: string; onGuardado: () => void }) {
  const [tipo, setTipo] = useState<"vacuna"|"tratamiento"|"antiparasitario">("vacuna");
  const [producto, setProducto] = useState("");
  const [saving, setSaving] = useState(false);
  const fecha = new Date().toISOString().slice(0, 10);

  async function guardar() {
    if (!producto.trim()) { toast.error("Ingresá el producto"); return; }
    setSaving(true);
    const { error } = await supabase.from("sanidad").insert({
      establecimiento_id: estId, animal_id: animal.id,
      tipo, producto: producto.trim(), fecha,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    onGuardado();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {(["vacuna","tratamiento","antiparasitario"] as const).map(t => (
          <button key={t} onClick={() => setTipo(t)}
            className={`h-14 rounded-xl text-sm font-bold capitalize ${tipo === t ? "bg-emerald-600 text-white" : "bg-gray-800 text-gray-300"}`}
          >{t}</button>
        ))}
      </div>
      <div>
        <label className="text-gray-400 text-sm uppercase tracking-wider">Producto</label>
        <Input
          autoFocus value={producto} onChange={e => setProducto(e.target.value)}
          placeholder="Nombre del producto"
          className="h-14 text-lg bg-gray-800 border-gray-700 text-white mt-2 rounded-xl"
        />
      </div>
      <Button onClick={guardar} disabled={saving || !producto.trim()}
        className="w-full h-16 text-2xl rounded-2xl bg-emerald-700 hover:bg-emerald-600">
        {saving ? "Guardando…" : "✓ Guardar"}
      </Button>
    </div>
  );
}

function TrasladoForm({ animal, estId, onGuardado }: { animal: Animal; estId: string; onGuardado: () => void }) {
  const [potreros, setPotreros] = useState<{id:string;nombre:string}[]>([]);
  const [destId, setDestId] = useState("");
  const [saving, setSaving] = useState(false);

  useState(() => {
    supabase.from("potreros").select("id, nombre").eq("establecimiento_id", estId).order("nombre")
      .then(({ data }) => setPotreros(data ?? []));
  });

  async function guardar() {
    if (!destId) { toast.error("Seleccioná el potrero destino"); return; }
    setSaving(true);
    await supabase.from("animales").update({ potrero_id: destId }).eq("id", animal.id);
    await supabase.from("movimientos").insert({
      establecimiento_id: estId, animal_id: animal.id, tipo: "traslado",
      potrero_origen_id: (animal.potrero as any)?.id ?? null,
      potrero_destino_id: destId,
      fecha: new Date().toISOString().slice(0, 10),
    });
    setSaving(false);
    onGuardado();
  }

  return (
    <div className="space-y-4">
      <label className="text-gray-400 text-sm uppercase tracking-wider">Potrero destino</label>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {potreros.filter(p => p.nombre !== animal.potrero?.nombre).map(p => (
          <button key={p.id} onClick={() => setDestId(p.id)}
            className={`w-full h-14 rounded-xl text-lg font-semibold text-left px-5 transition-all ${destId === p.id ? "bg-amber-500 text-black" : "bg-gray-800 text-gray-200 hover:bg-gray-700"}`}
          >{p.nombre}</button>
        ))}
      </div>
      <Button onClick={guardar} disabled={saving || !destId}
        className="w-full h-16 text-2xl rounded-2xl bg-amber-600 hover:bg-amber-500">
        {saving ? "Trasladando…" : `→ ${potreros.find(p => p.id === destId)?.nombre ?? "Seleccioná"}`}
      </Button>
    </div>
  );
}

function ParicionForm({ animal, estId, onGuardado }: { animal: Animal; estId: string; onGuardado: () => void }) {
  const [vivo, setVivo] = useState(true);
  const [sexo, setSexo] = useState<"hembra"|"macho">("hembra");
  const [caravanaCria, setCaravanaCria] = useState("");
  const [peso, setPeso] = useState("");
  const [saving, setSaving] = useState(false);
  const fecha = new Date().toISOString().slice(0, 10);

  async function guardar() {
    setSaving(true);
    let criaId: string | null = null;
    if (vivo && caravanaCria.trim()) {
      const { data: catTernero } = await supabase.from("categorias").select("id")
        .eq("nombre", sexo === "hembra" ? "Ternera" : "Ternero").maybeSingle();
      const { data: ins } = await supabase.from("animales").insert({
        establecimiento_id: estId, caravana: caravanaCria.trim(), sexo,
        fecha_nacimiento: fecha, peso_actual: peso ? Number(peso) : null,
        madre_id: animal.id, categoria_id: catTernero?.id ?? null,
      }).select("id").single();
      criaId = ins?.id ?? null;
    }
    const { error } = await supabase.from("pariciones").insert({
      establecimiento_id: estId, vaca_id: animal.id, cria_id: criaId,
      sexo_cria: sexo, peso_nacimiento: peso ? Number(peso) : null, vivo, fecha,
    });
    if (!error) await supabase.from("animales").update({ estado_reproductivo: "parida" }).eq("id", animal.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    onGuardado();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setVivo(true)}
          className={`h-16 rounded-xl text-xl font-bold ${vivo ? "bg-emerald-600 text-white" : "bg-gray-800 text-gray-300"}`}>
          Vivo
        </button>
        <button onClick={() => setVivo(false)}
          className={`h-16 rounded-xl text-xl font-bold ${!vivo ? "bg-red-700 text-white" : "bg-gray-800 text-gray-300"}`}>
          Muerto
        </button>
      </div>
      {vivo && (<>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setSexo("hembra")}
            className={`h-14 rounded-xl text-xl font-bold ${sexo === "hembra" ? "bg-pink-600 text-white" : "bg-gray-800 text-gray-300"}`}>
            ♀ Hembra
          </button>
          <button onClick={() => setSexo("macho")}
            className={`h-14 rounded-xl text-xl font-bold ${sexo === "macho" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300"}`}>
            ♂ Macho
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wider">Caravana cría</label>
            <Input value={caravanaCria} onChange={e => setCaravanaCria(e.target.value)}
              className="h-14 text-xl bg-gray-800 border-gray-700 text-white mt-1 rounded-xl font-mono" />
          </div>
          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wider">Peso nac. (kg)</label>
            <Input type="number" step="0.1" value={peso} onChange={e => setPeso(e.target.value)}
              className="h-14 text-xl bg-gray-800 border-gray-700 text-white mt-1 rounded-xl" />
          </div>
        </div>
      </>)}
      <Button onClick={guardar} disabled={saving}
        className="w-full h-16 text-2xl rounded-2xl bg-purple-700 hover:bg-purple-600">
        {saving ? "Guardando…" : "✓ Registrar parición"}
      </Button>
    </div>
  );
}

function DesteteFormManga({ animal, estId, onGuardado }: { animal: Animal; estId: string; onGuardado: () => void }) {
  const [peso, setPeso] = useState("");
  const [saving, setSaving] = useState(false);
  const fecha = new Date().toISOString().slice(0, 10);

  async function guardar() {
    setSaving(true);
    const { data: criaData } = await supabase.from("animales").select("madre_id").eq("id", animal.id).maybeSingle();
    const { error } = await supabase.from("destetes").insert({
      establecimiento_id: estId, cria_id: animal.id,
      peso_destete: peso ? Number(peso) : null, fecha,
    });
    if (!error) {
      if (peso) await supabase.from("pesadas").insert({
        establecimiento_id: estId, animal_id: animal.id, peso: Number(peso), fecha,
      });
      if (criaData?.madre_id) {
        await supabase.from("animales").update({ estado_reproductivo: "vacia" }).eq("id", criaData.madre_id);
      }
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    onGuardado();
  }

  return (
    <div className="space-y-4">
      <label className="text-gray-400 text-sm uppercase tracking-wider">Peso destete (kg) — opcional</label>
      <Input type="number" step="0.5" inputMode="decimal"
        value={peso} onChange={e => setPeso(e.target.value)}
        placeholder="000"
        className="h-24 text-5xl font-mono text-center bg-gray-800 border-gray-700 text-white placeholder:text-gray-600 rounded-2xl"
      />
      <Button onClick={guardar} disabled={saving}
        className="w-full h-16 text-2xl rounded-2xl bg-orange-600 hover:bg-orange-500">
        {saving ? "Guardando…" : "✓ Registrar destete"}
      </Button>
    </div>
  );
}
