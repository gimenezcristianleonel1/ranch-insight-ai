
-- ============ ENUMS / ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'encargado', 'asesor', 'auditor');
CREATE TYPE public.member_role AS ENUM ('propietario', 'encargado', 'operario', 'asesor');
CREATE TYPE public.sexo_animal AS ENUM ('macho', 'hembra');
CREATE TYPE public.tipo_movimiento AS ENUM ('nacimiento','compra','venta','muerte','traslado','cambio_categoria');
CREATE TYPE public.tipo_servicio AS ENUM ('natural','ia','iatf');
CREATE TYPE public.facilidad_parto AS ENUM ('sin_ayuda','ayuda_leve','ayuda_severa','cesarea');
CREATE TYPE public.tipo_sanidad AS ENUM ('tratamiento','vacuna','antiparasitario','enfermedad');

-- ============ UPDATED_AT HELPER ============
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own_or_any" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER set_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nombre)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ USER_ROLES (global app role) ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============ ESTABLECIMIENTOS ============
CREATE TABLE public.establecimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  propietario TEXT,
  provincia TEXT,
  localidad TEXT,
  ubicacion TEXT,
  superficie_total NUMERIC(12,2),
  superficie_ganadera NUMERIC(12,2),
  fecha_alta DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.establecimientos TO authenticated;
GRANT ALL ON public.establecimientos TO service_role;
ALTER TABLE public.establecimientos ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_est_updated BEFORE UPDATE ON public.establecimientos FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Member table (multi-user per establishment)
CREATE TABLE public.establecimiento_miembros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id UUID NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol public.member_role NOT NULL DEFAULT 'operario',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(establecimiento_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.establecimiento_miembros TO authenticated;
GRANT ALL ON public.establecimiento_miembros TO service_role;
ALTER TABLE public.establecimiento_miembros ENABLE ROW LEVEL SECURITY;

-- Helper: ¿el usuario es miembro del establecimiento?
CREATE OR REPLACE FUNCTION public.is_member(_est UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.establecimientos e WHERE e.id = _est AND e.owner_id = _user
    UNION
    SELECT 1 FROM public.establecimiento_miembros m WHERE m.establecimiento_id = _est AND m.user_id = _user
  )
$$;

CREATE POLICY "est_select" ON public.establecimientos FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_member(id, auth.uid()));
CREATE POLICY "est_insert" ON public.establecimientos FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "est_update_owner" ON public.establecimientos FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());
CREATE POLICY "est_delete_owner" ON public.establecimientos FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "miembros_select" ON public.establecimiento_miembros FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_member(establecimiento_id, auth.uid()));
CREATE POLICY "miembros_owner_manage" ON public.establecimiento_miembros FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.establecimientos e WHERE e.id = establecimiento_id AND e.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.establecimientos e WHERE e.id = establecimiento_id AND e.owner_id = auth.uid()));

-- Auto-add owner as miembro
CREATE OR REPLACE FUNCTION public.add_owner_as_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.establecimiento_miembros (establecimiento_id, user_id, rol)
  VALUES (NEW.id, NEW.owner_id, 'propietario')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_est_owner_member AFTER INSERT ON public.establecimientos
  FOR EACH ROW EXECUTE FUNCTION public.add_owner_as_member();

-- ============ RAZAS / CATEGORIAS / EV ============
CREATE TABLE public.razas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE
);
GRANT SELECT ON public.razas TO authenticated;
GRANT ALL ON public.razas TO service_role;
ALTER TABLE public.razas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "razas_read_all" ON public.razas FOR SELECT TO authenticated USING (true);
INSERT INTO public.razas (nombre) VALUES ('Angus'),('Brangus'),('Hereford'),('Braford'),('Brahman'),('Cruza');

CREATE TABLE public.categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  ev NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  requerimiento_ms NUMERIC(5,2) NOT NULL DEFAULT 10.0,
  orden INT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.categorias TO authenticated;
GRANT ALL ON public.categorias TO service_role;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categorias_read_all" ON public.categorias FOR SELECT TO authenticated USING (true);
INSERT INTO public.categorias (nombre, ev, requerimiento_ms, orden) VALUES
  ('Ternero', 0.40, 4.0, 1),
  ('Ternera', 0.40, 4.0, 2),
  ('Vaquillona', 0.80, 8.0, 3),
  ('Vaca', 1.00, 10.0, 4),
  ('Novillo', 0.90, 9.0, 5),
  ('Toro', 1.25, 12.0, 6);

-- ============ POTREROS ============
CREATE TABLE public.potreros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id UUID NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  hectareas NUMERIC(10,2) NOT NULL DEFAULT 0,
  tipo_suelo TEXT,
  tipo_pastura TEXT,
  ambiente TEXT,
  aguadas INT DEFAULT 0,
  estado TEXT DEFAULT 'activo',
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(establecimiento_id, nombre)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.potreros TO authenticated;
GRANT ALL ON public.potreros TO service_role;
ALTER TABLE public.potreros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "potreros_member_all" ON public.potreros FOR ALL TO authenticated
  USING (public.is_member(establecimiento_id, auth.uid()))
  WITH CHECK (public.is_member(establecimiento_id, auth.uid()));
CREATE TRIGGER set_potreros_updated BEFORE UPDATE ON public.potreros FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ ANIMALES ============
CREATE TABLE public.animales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id UUID NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  caravana TEXT NOT NULL,
  rfid TEXT,
  raza_id UUID REFERENCES public.razas(id),
  categoria_id UUID REFERENCES public.categorias(id),
  sexo public.sexo_animal NOT NULL,
  fecha_nacimiento DATE,
  peso_actual NUMERIC(7,2),
  estado TEXT DEFAULT 'activo', -- activo, vendido, muerto
  estado_reproductivo TEXT, -- vacia, servida, prenada, parida, lactando
  potrero_id UUID REFERENCES public.potreros(id) ON DELETE SET NULL,
  madre_id UUID REFERENCES public.animales(id),
  padre_id UUID REFERENCES public.animales(id),
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(establecimiento_id, caravana)
);
CREATE INDEX idx_animales_est ON public.animales(establecimiento_id);
CREATE INDEX idx_animales_potrero ON public.animales(potrero_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.animales TO authenticated;
GRANT ALL ON public.animales TO service_role;
ALTER TABLE public.animales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "animales_member_all" ON public.animales FOR ALL TO authenticated
  USING (public.is_member(establecimiento_id, auth.uid()))
  WITH CHECK (public.is_member(establecimiento_id, auth.uid()));
CREATE TRIGGER set_animales_updated BEFORE UPDATE ON public.animales FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ MOVIMIENTOS ============
CREATE TABLE public.movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id UUID NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  animal_id UUID REFERENCES public.animales(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo public.tipo_movimiento NOT NULL,
  origen TEXT,
  destino TEXT,
  potrero_origen_id UUID REFERENCES public.potreros(id),
  potrero_destino_id UUID REFERENCES public.potreros(id),
  observaciones TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mov_est_fecha ON public.movimientos(establecimiento_id, fecha DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimientos TO authenticated;
GRANT ALL ON public.movimientos TO service_role;
ALTER TABLE public.movimientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mov_member_all" ON public.movimientos FOR ALL TO authenticated
  USING (public.is_member(establecimiento_id, auth.uid()))
  WITH CHECK (public.is_member(establecimiento_id, auth.uid()));

-- ============ REPRODUCCION ============
CREATE TABLE public.servicios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id UUID NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  vaca_id UUID NOT NULL REFERENCES public.animales(id) ON DELETE CASCADE,
  toro_id UUID REFERENCES public.animales(id),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo public.tipo_servicio NOT NULL DEFAULT 'natural',
  lote TEXT,
  observaciones TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(vaca_id, fecha)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.servicios TO authenticated;
GRANT ALL ON public.servicios TO service_role;
ALTER TABLE public.servicios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "serv_member_all" ON public.servicios FOR ALL TO authenticated
  USING (public.is_member(establecimiento_id, auth.uid()))
  WITH CHECK (public.is_member(establecimiento_id, auth.uid()));

CREATE TABLE public.diagnosticos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id UUID NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  vaca_id UUID NOT NULL REFERENCES public.animales(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  resultado BOOLEAN NOT NULL,
  edad_fetal_dias INT,
  veterinario TEXT,
  observaciones TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_diag_vaca ON public.diagnosticos(vaca_id, fecha DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnosticos TO authenticated;
GRANT ALL ON public.diagnosticos TO service_role;
ALTER TABLE public.diagnosticos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "diag_member_all" ON public.diagnosticos FOR ALL TO authenticated
  USING (public.is_member(establecimiento_id, auth.uid()))
  WITH CHECK (public.is_member(establecimiento_id, auth.uid()));

CREATE TABLE public.pariciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id UUID NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  vaca_id UUID NOT NULL REFERENCES public.animales(id) ON DELETE CASCADE,
  cria_id UUID REFERENCES public.animales(id),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  sexo_cria public.sexo_animal,
  peso_nacimiento NUMERIC(6,2),
  facilidad public.facilidad_parto DEFAULT 'sin_ayuda',
  vivo BOOLEAN NOT NULL DEFAULT true,
  observaciones TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pariciones TO authenticated;
GRANT ALL ON public.pariciones TO service_role;
ALTER TABLE public.pariciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "par_member_all" ON public.pariciones FOR ALL TO authenticated
  USING (public.is_member(establecimiento_id, auth.uid()))
  WITH CHECK (public.is_member(establecimiento_id, auth.uid()));

CREATE TABLE public.destetes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id UUID NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  cria_id UUID NOT NULL REFERENCES public.animales(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  peso_destete NUMERIC(7,2),
  observaciones TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.destetes TO authenticated;
GRANT ALL ON public.destetes TO service_role;
ALTER TABLE public.destetes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dest_member_all" ON public.destetes FOR ALL TO authenticated
  USING (public.is_member(establecimiento_id, auth.uid()))
  WITH CHECK (public.is_member(establecimiento_id, auth.uid()));

CREATE TABLE public.abortos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id UUID NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  vaca_id UUID NOT NULL REFERENCES public.animales(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  causa TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.abortos TO authenticated;
GRANT ALL ON public.abortos TO service_role;
ALTER TABLE public.abortos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "abortos_member_all" ON public.abortos FOR ALL TO authenticated
  USING (public.is_member(establecimiento_id, auth.uid()))
  WITH CHECK (public.is_member(establecimiento_id, auth.uid()));

-- ============ SANIDAD ============
CREATE TABLE public.sanidad (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id UUID NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  animal_id UUID NOT NULL REFERENCES public.animales(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo public.tipo_sanidad NOT NULL DEFAULT 'tratamiento',
  producto TEXT NOT NULL,
  dosis NUMERIC(8,2),
  unidad TEXT,
  costo NUMERIC(12,2),
  veterinario TEXT,
  observaciones TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sanidad_animal ON public.sanidad(animal_id, fecha DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sanidad TO authenticated;
GRANT ALL ON public.sanidad TO service_role;
ALTER TABLE public.sanidad ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sanidad_member_all" ON public.sanidad FOR ALL TO authenticated
  USING (public.is_member(establecimiento_id, auth.uid()))
  WITH CHECK (public.is_member(establecimiento_id, auth.uid()));

-- ============ PESADAS ============
CREATE TABLE public.pesadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id UUID NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  animal_id UUID NOT NULL REFERENCES public.animales(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  peso NUMERIC(7,2) NOT NULL,
  observaciones TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pesadas_animal ON public.pesadas(animal_id, fecha DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pesadas TO authenticated;
GRANT ALL ON public.pesadas TO service_role;
ALTER TABLE public.pesadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pesadas_member_all" ON public.pesadas FOR ALL TO authenticated
  USING (public.is_member(establecimiento_id, auth.uid()))
  WITH CHECK (public.is_member(establecimiento_id, auth.uid()));

-- Trigger: actualizar peso_actual del animal al insertar pesada
CREATE OR REPLACE FUNCTION public.tg_update_peso_animal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.animales SET peso_actual = NEW.peso, updated_at = now() WHERE id = NEW.animal_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_pesada_actualiza_peso AFTER INSERT ON public.pesadas
  FOR EACH ROW EXECUTE FUNCTION public.tg_update_peso_animal();

-- ============ IA ============
CREATE TABLE public.ia_consultas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id UUID REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pregunta TEXT NOT NULL,
  respuesta TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.ia_consultas TO authenticated;
GRANT ALL ON public.ia_consultas TO service_role;
ALTER TABLE public.ia_consultas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ia_consultas_own" ON public.ia_consultas FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.ia_alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id UUID NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  prioridad TEXT NOT NULL DEFAULT 'media', -- baja, media, alta
  mensaje TEXT NOT NULL,
  resuelta BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_alertas TO authenticated;
GRANT ALL ON public.ia_alertas TO service_role;
ALTER TABLE public.ia_alertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alertas_member_all" ON public.ia_alertas FOR ALL TO authenticated
  USING (public.is_member(establecimiento_id, auth.uid()))
  WITH CHECK (public.is_member(establecimiento_id, auth.uid()));
