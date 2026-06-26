-- FASE 1: ESTABILIZACIÓN
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_animales_caravana ON public.animales(establecimiento_id, caravana);
CREATE INDEX IF NOT EXISTS idx_animales_estado ON public.animales(establecimiento_id, estado);
CREATE INDEX IF NOT EXISTS idx_animales_categoria ON public.animales(establecimiento_id, categoria_id);
CREATE INDEX IF NOT EXISTS idx_mov_tipo ON public.movimientos(establecimiento_id, tipo, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_sanidad_est_tipo ON public.sanidad(establecimiento_id, tipo, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_tareas_vencimiento ON public.tareas(establecimiento_id, fecha, estado) WHERE estado != 'completada';
ALTER TABLE public.sanidad ADD COLUMN IF NOT EXISTS proxima_aplicacion DATE;
ALTER TABLE public.tareas ADD COLUMN IF NOT EXISTS completada_en TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_alertas_pendientes ON public.ia_alertas(establecimiento_id, resuelta, created_at DESC) WHERE resuelta = false;

CREATE OR REPLACE FUNCTION public.stock_potrero(_potrero_id UUID)
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::INT FROM public.animales WHERE potrero_id = _potrero_id AND estado = 'activo';
$$;

CREATE OR REPLACE FUNCTION public.ev_potrero(_potrero_id UUID)
RETURNS NUMERIC LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(c.ev), 0) FROM public.animales a
  JOIN public.categorias c ON c.id = a.categoria_id
  WHERE a.potrero_id = _potrero_id AND a.estado = 'activo';
$$;

CREATE OR REPLACE VIEW public.v_stock_potrero AS
SELECT a.establecimiento_id, a.potrero_id, p.nombre AS potrero_nombre, p.hectareas,
  c.nombre AS categoria, c.ev AS ev_unitario, a.sexo,
  COUNT(*)::INT AS cantidad, COUNT(*) * c.ev AS ev_total
FROM public.animales a
JOIN public.categorias c ON c.id = a.categoria_id
LEFT JOIN public.potreros p ON p.id = a.potrero_id
WHERE a.estado = 'activo'
GROUP BY a.establecimiento_id, a.potrero_id, p.nombre, p.hectareas, c.nombre, c.ev, a.sexo;
GRANT SELECT ON public.v_stock_potrero TO authenticated;

CREATE OR REPLACE VIEW public.v_balance_forrajero AS
SELECT sp.establecimiento_id, sp.potrero_id, sp.potrero_nombre, sp.hectareas,
  COALESCE(SUM(sp.cantidad), 0)::INT AS total_animales,
  COALESCE(SUM(sp.ev_total), 0) AS ev_totales,
  CASE WHEN sp.hectareas > 0 THEN ROUND(SUM(sp.ev_total) / sp.hectareas, 3) ELSE 0 END AS ev_por_ha,
  COALESCE(SUM(sp.cantidad * c.requerimiento_ms), 0) AS req_ms_dia
FROM public.v_stock_potrero sp
JOIN public.categorias c ON c.nombre = sp.categoria
GROUP BY sp.establecimiento_id, sp.potrero_id, sp.potrero_nombre, sp.hectareas;
GRANT SELECT ON public.v_balance_forrajero TO authenticated;

-- IMPORTADOR INTELIGENTE
CREATE TABLE IF NOT EXISTS public.plantillas_importacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  tipo TEXT NOT NULL DEFAULT 'animales',
  configuracion_json JSONB NOT NULL DEFAULT '{}',
  usos INT NOT NULL DEFAULT 0,
  ultima_vez TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plantillas_user ON public.plantillas_importacion(user_id, tipo);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plantillas_importacion TO authenticated;
GRANT ALL ON public.plantillas_importacion TO service_role;
ALTER TABLE public.plantillas_importacion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plantillas_own" ON public.plantillas_importacion;
CREATE POLICY "plantillas_own" ON public.plantillas_importacion
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP TRIGGER IF EXISTS set_plantillas_updated ON public.plantillas_importacion;
CREATE TRIGGER set_plantillas_updated BEFORE UPDATE ON public.plantillas_importacion
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.import_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'animales',
  alias_texto TEXT NOT NULL,
  campo_sistema TEXT NOT NULL,
  confirmaciones INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tipo, alias_texto)
);
CREATE INDEX IF NOT EXISTS idx_aliases_user_tipo ON public.import_aliases(user_id, tipo);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_aliases TO authenticated;
GRANT ALL ON public.import_aliases TO service_role;
ALTER TABLE public.import_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aliases_own" ON public.import_aliases;
CREATE POLICY "aliases_own" ON public.import_aliases
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP TRIGGER IF EXISTS set_aliases_updated ON public.import_aliases;
CREATE TRIGGER set_aliases_updated BEFORE UPDATE ON public.import_aliases
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();