
CREATE TABLE public.tareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id UUID NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  fecha DATE NOT NULL,
  hora TIME,
  prioridad TEXT NOT NULL DEFAULT 'media' CHECK (prioridad IN ('baja','media','alta','urgente')),
  categoria TEXT,
  responsable TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_progreso','completada','cancelada')),
  observaciones TEXT,
  animal_id UUID REFERENCES public.animales(id) ON DELETE SET NULL,
  potrero_id UUID REFERENCES public.potreros(id) ON DELETE SET NULL,
  sanidad_id UUID REFERENCES public.sanidad(id) ON DELETE SET NULL,
  servicio_id UUID REFERENCES public.servicios(id) ON DELETE SET NULL,
  completada_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tareas_est_fecha ON public.tareas(establecimiento_id, fecha);
CREATE INDEX idx_tareas_estado ON public.tareas(establecimiento_id, estado);
CREATE INDEX idx_tareas_animal ON public.tareas(animal_id);
CREATE INDEX idx_tareas_potrero ON public.tareas(potrero_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tareas TO authenticated;
GRANT ALL ON public.tareas TO service_role;

ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros pueden gestionar tareas del establecimiento"
ON public.tareas FOR ALL
TO authenticated
USING (public.is_member(establecimiento_id, auth.uid()))
WITH CHECK (public.is_member(establecimiento_id, auth.uid()));

CREATE TRIGGER tg_tareas_updated_at
BEFORE UPDATE ON public.tareas
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
