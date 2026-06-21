
-- Tabla archivos (metadata de objetos en storage)
CREATE TABLE public.archivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  entity_type text NOT NULL,            -- 'animal' | 'potrero' | 'sanidad' | 'movimiento' | 'finanza' | 'tarea' | 'otro'
  entity_id uuid,                       -- opcional
  bucket text NOT NULL DEFAULT 'gestion-ganadera',
  path text NOT NULL,                   -- path completo en el bucket
  nombre text NOT NULL,
  tipo_mime text,
  tamano_bytes bigint,
  categoria text,                       -- 'foto_animal' | 'foto_caravana' | 'comprobante' | 'pdf' | 'excel' | 'foto_potrero' | 'otro'
  descripcion text,
  subido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_archivos_est ON public.archivos(establecimiento_id);
CREATE INDEX idx_archivos_entity ON public.archivos(entity_type, entity_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.archivos TO authenticated;
GRANT ALL ON public.archivos TO service_role;

ALTER TABLE public.archivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "miembros gestionan archivos"
  ON public.archivos FOR ALL
  TO authenticated
  USING (public.is_member(establecimiento_id, auth.uid()))
  WITH CHECK (public.is_member(establecimiento_id, auth.uid()));

CREATE TRIGGER tg_archivos_updated
  BEFORE UPDATE ON public.archivos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Políticas de Storage para el bucket gestion-ganadera
-- Convención de path: {establecimiento_id}/{entity_type}/{filename}
CREATE POLICY "gg_select_miembros"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'gestion-ganadera'
    AND public.is_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

CREATE POLICY "gg_insert_miembros"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'gestion-ganadera'
    AND public.is_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

CREATE POLICY "gg_update_miembros"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'gestion-ganadera'
    AND public.is_member((storage.foldername(name))[1]::uuid, auth.uid())
  )
  WITH CHECK (
    bucket_id = 'gestion-ganadera'
    AND public.is_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

CREATE POLICY "gg_delete_miembros"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'gestion-ganadera'
    AND public.is_member((storage.foldername(name))[1]::uuid, auth.uid())
  );
