import { supabase } from "@/integrations/supabase/client";

export const BUCKET = "gestion-ganadera";

export type EntityType = "animal" | "potrero" | "sanidad" | "movimiento" | "finanza" | "tarea" | "otro";

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function uploadFile(opts: {
  file: File;
  establecimientoId: string;
  entityType: EntityType;
  entityId?: string | null;
  categoria?: string;
  descripcion?: string;
}) {
  const { file, establecimientoId, entityType, entityId, categoria, descripcion } = opts;
  const ts = Date.now();
  const path = `${establecimientoId}/${entityType}/${entityId ?? "general"}/${ts}-${sanitize(file.name)}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("archivos")
    .insert({
      establecimiento_id: establecimientoId,
      entity_type: entityType,
      entity_id: entityId ?? null,
      bucket: BUCKET,
      path,
      nombre: file.name,
      tipo_mime: file.type || null,
      tamano_bytes: file.size,
      categoria: categoria ?? null,
      descripcion: descripcion ?? null,
      subido_por: userData.user?.id ?? null,
    })
    .select()
    .single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
  return data;
}

export async function listFiles(entityType: EntityType, entityId: string) {
  const { data, error } = await supabase
    .from("archivos")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getSignedUrl(path: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function downloadFile(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw error;
  return data;
}

export async function deleteFile(archivoId: string, path: string) {
  const { error: sErr } = await supabase.storage.from(BUCKET).remove([path]);
  if (sErr) throw sErr;
  const { error } = await supabase.from("archivos").delete().eq("id", archivoId);
  if (error) throw error;
}