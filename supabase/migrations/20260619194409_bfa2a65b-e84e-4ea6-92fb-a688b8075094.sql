
-- AFOROS (forrajes / balance forrajero)
CREATE TABLE public.aforos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  potrero_id uuid REFERENCES public.potreros(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  kg_ms_ha numeric NOT NULL,
  altura_cm numeric,
  metodo text,
  observaciones text,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aforos TO authenticated;
GRANT ALL ON public.aforos TO service_role;
ALTER TABLE public.aforos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aforos_members" ON public.aforos FOR ALL TO authenticated
  USING (public.is_member(establecimiento_id, auth.uid()))
  WITH CHECK (public.is_member(establecimiento_id, auth.uid()));

-- AGUADAS
CREATE TABLE public.aguadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  potrero_id uuid REFERENCES public.potreros(id) ON DELETE SET NULL,
  nombre text NOT NULL,
  tipo text NOT NULL DEFAULT 'tanque', -- molino, tanque, represa, vertiente, perforacion
  capacidad_litros numeric,
  estado text NOT NULL DEFAULT 'operativa', -- operativa, mantenimiento, fuera_servicio
  lat numeric, lng numeric,
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aguadas TO authenticated;
GRANT ALL ON public.aguadas TO service_role;
ALTER TABLE public.aguadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aguadas_members" ON public.aguadas FOR ALL TO authenticated
  USING (public.is_member(establecimiento_id, auth.uid()))
  WITH CHECK (public.is_member(establecimiento_id, auth.uid()));
CREATE TRIGGER aguadas_updated BEFORE UPDATE ON public.aguadas FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ALAMBRADOS
CREATE TABLE public.alambrados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  tipo text NOT NULL DEFAULT 'perimetral', -- perimetral, division, electrico
  km numeric NOT NULL DEFAULT 0,
  hilos int,
  estado text NOT NULL DEFAULT 'bueno', -- bueno, regular, malo
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alambrados TO authenticated;
GRANT ALL ON public.alambrados TO service_role;
ALTER TABLE public.alambrados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alambrados_members" ON public.alambrados FOR ALL TO authenticated
  USING (public.is_member(establecimiento_id, auth.uid()))
  WITH CHECK (public.is_member(establecimiento_id, auth.uid()));
CREATE TRIGGER alambrados_updated BEFORE UPDATE ON public.alambrados FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- FINANZAS: categorias
CREATE TABLE public.finanzas_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('ingreso','egreso')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finanzas_categorias TO authenticated;
GRANT ALL ON public.finanzas_categorias TO service_role;
ALTER TABLE public.finanzas_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finc_members" ON public.finanzas_categorias FOR ALL TO authenticated
  USING (public.is_member(establecimiento_id, auth.uid()))
  WITH CHECK (public.is_member(establecimiento_id, auth.uid()));

-- FINANZAS: movimientos
CREATE TABLE public.finanzas_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  tipo text NOT NULL CHECK (tipo IN ('ingreso','egreso')),
  categoria_id uuid REFERENCES public.finanzas_categorias(id) ON DELETE SET NULL,
  concepto text NOT NULL,
  monto numeric NOT NULL,
  moneda text NOT NULL DEFAULT 'ARS',
  cantidad numeric,
  unidad text,
  observaciones text,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finanzas_movimientos TO authenticated;
GRANT ALL ON public.finanzas_movimientos TO service_role;
ALTER TABLE public.finanzas_movimientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finm_members" ON public.finanzas_movimientos FOR ALL TO authenticated
  USING (public.is_member(establecimiento_id, auth.uid()))
  WITH CHECK (public.is_member(establecimiento_id, auth.uid()));

-- AUDITORIA
CREATE TABLE public.auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id uuid REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  accion text NOT NULL,
  entidad text NOT NULL,
  entidad_id uuid,
  detalle jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.auditoria TO authenticated;
GRANT ALL ON public.auditoria TO service_role;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aud_read" ON public.auditoria FOR SELECT TO authenticated
  USING (establecimiento_id IS NULL OR public.is_member(establecimiento_id, auth.uid()));
CREATE POLICY "aud_insert" ON public.auditoria FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX aforos_est_fecha ON public.aforos(establecimiento_id, fecha DESC);
CREATE INDEX finm_est_fecha ON public.finanzas_movimientos(establecimiento_id, fecha DESC);
CREATE INDEX aud_est_fecha ON public.auditoria(establecimiento_id, created_at DESC);
