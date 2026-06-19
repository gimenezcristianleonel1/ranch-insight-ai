import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const KEY = "ganadero_est_activo";

export type EstablecimientoLite = {
  id: string;
  nombre: string;
  superficie_ganadera: number | null;
};

export function useEstablecimientos() {
  const [data, setData] = useState<EstablecimientoLite[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("establecimientos")
      .select("id, nombre, superficie_ganadera")
      .order("created_at", { ascending: true });
    if (!error && data) setData(data as EstablecimientoLite[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, refresh };
}

export function useActiveEstablecimiento() {
  const { data, loading, refresh } = useEstablecimientos();
  const [activeId, setActiveIdState] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(KEY);
    if (stored && data.some((e) => e.id === stored)) {
      setActiveIdState(stored);
    } else if (data[0]) {
      setActiveIdState(data[0].id);
      localStorage.setItem(KEY, data[0].id);
    } else {
      setActiveIdState(null);
    }
  }, [data]);

  const setActiveId = useCallback((id: string) => {
    setActiveIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(KEY, id);
  }, []);

  const active = data.find((e) => e.id === activeId) ?? null;
  return { establecimientos: data, active, activeId, setActiveId, loading, refresh };
}