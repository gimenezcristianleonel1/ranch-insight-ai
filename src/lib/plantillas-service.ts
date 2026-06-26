/**
 * plantillas-service.ts
 * Gestiona plantillas de importación y aliases aprendidos en Supabase.
 */
import { supabase } from "@/integrations/supabase/client";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TipoPlantilla =
  | "animales" | "reproduccion" | "pesadas" | "sanidad"
  | "potreros" | "finanzas" | "compras" | "ventas" | "tactos";

export type MappingGuardado = Record<string, string | null>; // col → campo

export type Plantilla = {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo: TipoPlantilla;
  configuracion_json: {
    mapping: MappingGuardado;
    columnas_originales: string[]; // encabezados del archivo original
  };
  usos: number;
  ultima_vez: string | null;
  created_at: string;
};

// ─── Normalización de encabezados ────────────────────────────────────────────

export function normalizarHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// ─── Calcular similitud entre dos conjuntos de columnas ──────────────────────

export function calcularCompatibilidad(
  columnasPlanilla: string[],
  columnasArchivo: string[]
): number {
  const normPlanilla = columnasPlanilla.map(normalizarHeader);
  const normArchivo = columnasArchivo.map(normalizarHeader);

  let coincidencias = 0;
  for (const col of normArchivo) {
    if (normPlanilla.includes(col)) coincidencias++;
  }

  const total = Math.max(normPlanilla.length, normArchivo.length);
  return total > 0 ? Math.round((coincidencias / total) * 100) : 0;
}

// ─── Adaptar mapping de plantilla a columnas actuales del archivo ─────────────

export function adaptarMapping(
  plantilla: Plantilla,
  columnasArchivo: string[]
): MappingGuardado {
  const mapping: MappingGuardado = {};
  const normArchivo = new Map(columnasArchivo.map((c) => [normalizarHeader(c), c]));

  // Construir mapa inverso: normColOriginal → campo
  const plantillaMapping = plantilla.configuracion_json.mapping;
  const normToField = new Map<string, string | null>();
  for (const [col, field] of Object.entries(plantillaMapping)) {
    normToField.set(normalizarHeader(col), field);
  }

  // Para cada columna del archivo nuevo, buscar el campo correspondiente
  for (const col of columnasArchivo) {
    const norm = normalizarHeader(col);
    mapping[col] = normToField.get(norm) ?? null;
  }

  return mapping;
}

// ─── CRUD Plantillas ──────────────────────────────────────────────────────────

export async function listarPlantillas(tipo?: TipoPlantilla): Promise<Plantilla[]> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return [];

  let q = supabase
    .from("plantillas_importacion")
    .select("*")
    .eq("user_id", user.user.id)
    .order("usos", { ascending: false });

  if (tipo) q = (q as any).eq("tipo", tipo);

  const { data } = await q;
  return (data as Plantilla[]) ?? [];
}

export async function guardarPlantilla(
  nombre: string,
  tipo: TipoPlantilla,
  mapping: MappingGuardado,
  columnasOriginales: string[],
  descripcion?: string,
  idExistente?: string
): Promise<Plantilla | null> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return null;

  const payload = {
    user_id: user.user.id,
    nombre,
    descripcion: descripcion ?? null,
    tipo,
    configuracion_json: { mapping, columnas_originales: columnasOriginales },
    ultima_vez: new Date().toISOString(),
  };

  if (idExistente) {
    const { data } = await supabase
      .from("plantillas_importacion")
      .update({ ...payload, usos: undefined })
      .eq("id", idExistente)
      .select()
      .single();
    return data as Plantilla;
  }

  const { data } = await supabase
    .from("plantillas_importacion")
    .insert(payload)
    .select()
    .single();
  return data as Plantilla;
}

export async function incrementarUsos(id: string): Promise<void> {
  await supabase.rpc
    ? supabase.from("plantillas_importacion").update({ ultima_vez: new Date().toISOString() }).eq("id", id)
    : null;
  // Incremento manual
  const { data } = await supabase
    .from("plantillas_importacion")
    .select("usos")
    .eq("id", id)
    .single();
  if (data) {
    await supabase
      .from("plantillas_importacion")
      .update({ usos: (data.usos ?? 0) + 1, ultima_vez: new Date().toISOString() })
      .eq("id", id);
  }
}

export async function eliminarPlantilla(id: string): Promise<void> {
  await supabase.from("plantillas_importacion").delete().eq("id", id);
}

// ─── Aliases aprendidos ───────────────────────────────────────────────────────

/**
 * Carga todos los aliases aprendidos por el usuario para un tipo.
 * Retorna un Map: normAlias → campoDestino
 */
export async function cargarAliases(tipo: TipoPlantilla): Promise<Map<string, string>> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return new Map();

  const { data } = await supabase
    .from("import_aliases")
    .select("alias_texto, campo_sistema")
    .eq("user_id", user.user.id)
    .eq("tipo", tipo);

  const map = new Map<string, string>();
  for (const row of (data ?? []) as any[]) {
    map.set(row.alias_texto, row.campo_sistema);
  }
  return map;
}

/**
 * Registra o refuerza aliases cuando el usuario confirma un mapeo.
 */
export async function aprenderAliases(
  tipo: TipoPlantilla,
  mapping: MappingGuardado
): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return;

  const userId = user.user.id;
  const filas = Object.entries(mapping)
    .filter(([, v]) => v !== null)
    .map(([col, campo]) => ({
      user_id: userId,
      tipo,
      alias_texto: normalizarHeader(col),
      campo_sistema: campo!,
      confirmaciones: 1,
    }));

  if (!filas.length) return;

  // Upsert: si ya existe el alias, sumar una confirmación
  await supabase.from("import_aliases").upsert(filas, {
    onConflict: "user_id,tipo,alias_texto",
    ignoreDuplicates: false,
  });

  // Sumar confirmaciones a los existentes
  for (const fila of filas) {
    const { data: existing } = await supabase
      .from("import_aliases")
      .select("id, confirmaciones")
      .eq("user_id", userId)
      .eq("tipo", tipo)
      .eq("alias_texto", fila.alias_texto)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("import_aliases")
        .update({ confirmaciones: (existing.confirmaciones ?? 1) + 1 })
        .eq("id", existing.id);
    }
  }
}

// ─── Detección automática de la mejor plantilla ───────────────────────────────

export async function detectarPlantilla(
  columnasArchivo: string[],
  tipo: TipoPlantilla
): Promise<{ plantilla: Plantilla; compatibilidad: number } | null> {
  const plantillas = await listarPlantillas(tipo);
  if (!plantillas.length) return null;

  let mejorPlantilla: Plantilla | null = null;
  let mejorPct = 0;

  for (const p of plantillas) {
    const pct = calcularCompatibilidad(
      p.configuracion_json.columnas_originales,
      columnasArchivo
    );
    if (pct > mejorPct) {
      mejorPct = pct;
      mejorPlantilla = p;
    }
  }

  if (!mejorPlantilla || mejorPct < 40) return null;
  return { plantilla: mejorPlantilla, compatibilidad: mejorPct };
}
