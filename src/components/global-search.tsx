import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEstablecimiento } from "@/hooks/use-establecimiento";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Search } from "lucide-react";

type Hit = { id: string; caravana: string; rfid: string | null; sexo: string };

export function GlobalSearch() {
  const navigate = useNavigate();
  const { activeId } = useActiveEstablecimiento();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open || !activeId) return;
    const t = setTimeout(async () => {
      let qb = supabase
        .from("animales")
        .select("id, caravana, rfid, sexo")
        .eq("establecimiento_id", activeId)
        .order("caravana")
        .limit(20);
      if (q.trim()) qb = qb.or(`caravana.ilike.%${q.trim()}%,rfid.ilike.%${q.trim()}%`);
      const { data } = await qb;
      setHits((data as Hit[]) ?? []);
    }, 120);
    return () => clearTimeout(t);
  }, [q, open, activeId]);

  function pick(id: string) {
    setOpen(false);
    setQ("");
    navigate({ to: "/animales/$id", params: { id } });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-2 text-muted-foreground w-full max-w-xs justify-start"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4" />
        <span className="text-xs">Buscar caravana…</span>
        <kbd className="ml-auto pointer-events-none hidden md:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
          ⌘K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Caravana o RFID…" value={q} onValueChange={setQ} />
        <CommandList>
          <CommandEmpty>Sin resultados.</CommandEmpty>
          <CommandGroup heading="Animales">
            {hits.map((h) => (
              <CommandItem key={h.id} value={`${h.caravana} ${h.rfid ?? ""}`} onSelect={() => pick(h.id)}>
                <span className="font-medium tabular-nums">{h.caravana}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {h.sexo === "hembra" ? "♀" : "♂"} {h.rfid ? `· ${h.rfid}` : ""}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}