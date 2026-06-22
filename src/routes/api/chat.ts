import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

type Body = { messages?: unknown; establecimientoId?: string };

const MessagePartSchema = z.object({
  type: z.string().max(64),
  text: z.string().max(8000).optional(),
}).passthrough();

const MessageSchema = z.object({
  id: z.string().max(128).optional(),
  role: z.enum(["user", "assistant", "system"]),
  parts: z.array(MessagePartSchema).max(64).optional(),
  content: z.string().max(8000).optional(),
}).passthrough();

const MessagesSchema = z.array(MessageSchema).min(1).max(50);

async function buildContext(establecimientoId: string, token: string): Promise<string> {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } },
  );

  const [est, animales, cats, servicios, diags, pariciones, destetes, potreros, sanidad] = await Promise.all([
    supabase.from("establecimientos").select("nombre, superficie_ganadera, provincia").eq("id", establecimientoId).maybeSingle(),
    supabase.from("animales").select("sexo, categoria_id, estado, estado_reproductivo").eq("establecimiento_id", establecimientoId).eq("estado", "activo"),
    supabase.from("categorias").select("id, nombre, ev"),
    supabase.from("servicios").select("vaca_id, fecha").eq("establecimiento_id", establecimientoId),
    supabase.from("diagnosticos").select("vaca_id, resultado, fecha").eq("establecimiento_id", establecimientoId),
    supabase.from("pariciones").select("fecha, vivo").eq("establecimiento_id", establecimientoId),
    supabase.from("destetes").select("fecha, peso_destete").eq("establecimiento_id", establecimientoId),
    supabase.from("potreros").select("nombre, hectareas, tipo_pastura").eq("establecimiento_id", establecimientoId),
    supabase.from("sanidad").select("tipo, producto, fecha").eq("establecimiento_id", establecimientoId).order("fecha", { ascending: false }).limit(20),
  ]);

  const catMap = new Map((cats.data ?? []).map((c) => [c.id, c]));
  const a = animales.data ?? [];
  const byCat = (n: string) => a.filter((x) => catMap.get(x.categoria_id ?? "")?.nombre === n).length;
  const ev = a.reduce((acc, an) => acc + Number(catMap.get(an.categoria_id ?? "")?.ev ?? 0), 0);
  const sup = Number(est.data?.superficie_ganadera ?? 0);
  const entoradas = new Set((servicios.data ?? []).map((s) => s.vaca_id)).size;
  const prenadas = new Set((diags.data ?? []).filter((d) => d.resultado).map((d) => d.vaca_id)).size;
  const vacias = new Set((diags.data ?? []).filter((d) => !d.resultado).map((d) => d.vaca_id)).size;
  const preniezPct = entoradas > 0 ? (prenadas / entoradas) * 100 : 0;
  const paricionesVivas = (pariciones.data ?? []).filter((p) => p.vivo).length;
  const destetePct = entoradas > 0 ? ((destetes.data?.length ?? 0) / entoradas) * 100 : 0;
  const pesoDesteteProm = (destetes.data ?? []).filter((d) => d.peso_destete).reduce((s, d) => s + Number(d.peso_destete), 0) / Math.max(1, (destetes.data ?? []).filter((d) => d.peso_destete).length);

  return `
DATOS DEL ESTABLECIMIENTO "${est.data?.nombre ?? "—"}" (${est.data?.provincia ?? "—"}):
- Superficie ganadera: ${sup} ha
- Stock activo: ${a.length} animales
- Composición: Vacas ${byCat("Vaca")}, Vaquillonas ${byCat("Vaquillona")}, Terneros ${byCat("Ternero") + byCat("Ternera")}, Toros ${byCat("Toro")}, Novillos ${byCat("Novillo")}
- EV totales: ${ev.toFixed(1)}  |  Carga animal: ${(sup > 0 ? ev / sup : 0).toFixed(2)} EV/ha
- Potreros: ${(potreros.data ?? []).length} (${(potreros.data ?? []).reduce((s, p) => s + Number(p.hectareas), 0)} ha)

REPRODUCCIÓN (últimos 12 meses):
- Vacas entoradas: ${entoradas}
- Vacas preñadas: ${prenadas}  |  Vacas vacías diagnosticadas: ${vacias}
- % Preñez: ${preniezPct.toFixed(1)}%
- Pariciones vivas: ${paricionesVivas}
- Destetes: ${destetes.data?.length ?? 0}  |  % Destete: ${destetePct.toFixed(1)}%  |  Peso destete promedio: ${isFinite(pesoDesteteProm) ? pesoDesteteProm.toFixed(0) : "—"} kg

ÚLTIMOS EVENTOS SANITARIOS: ${(sanidad.data ?? []).slice(0, 5).map((s) => `${s.fecha} ${s.tipo} ${s.producto}`).join("; ") || "ninguno"}
`.trim();
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Require authentication
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice("Bearer ".length).trim();
        if (!token) return new Response("Unauthorized", { status: 401 });

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Server misconfigured", { status: 500 });
        }
        const authClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token);
        if (claimsErr || !claimsData?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }

        // 2. Parse + validate body
        const { messages: rawMessages, establecimientoId } = (await request.json()) as Body;
        const parsed = MessagesSchema.safeParse(rawMessages);
        if (!parsed.success) {
          return new Response("Invalid messages payload", { status: 400 });
        }
        const messages = parsed.data as unknown as UIMessage[];

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        let context = "Sin datos del establecimiento — el usuario debe seleccionar uno.";
        if (establecimientoId && typeof establecimientoId === "string") {
          try { context = await buildContext(establecimientoId, token); } catch (e) { console.error(e); }
        }

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system: `Sos un asesor ganadero experto en cría bovina en Argentina. Hablás en español rioplatense, directo y práctico, como un veterinario o ingeniero agrónomo conversando con el productor.

Tenés acceso a los datos REALES del establecimiento del usuario (más abajo). Respondé SIEMPRE basándote en esos datos. Si la pregunta requiere un dato que no está, decilo claramente y sugerí qué cargar.

Reglas:
- Sé conciso. Frases cortas. Listas cuando ayude.
- Si te piden un índice (preñez, destete, EV, carga, etc.) dalo con el número y una interpretación breve (objetivo, si está bien o no).
- Si detectás problemas (carga alta, baja preñez, etc.) recomendá acciones concretas.
- Usá unidades argentinas: ha, kg, EV/ha, %.

${context}`,
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse();
      },
    },
  },
});