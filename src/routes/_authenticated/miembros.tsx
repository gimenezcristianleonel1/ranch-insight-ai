import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEstablecimiento } from "@/hooks/use-establecimiento";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, Users, Crown, Shield, Wrench, BookOpen } from "lucide-react";
import { ConfirmDelete } from "@/components/confirm";

export const Route = createFileRoute("/_authenticated/miembros")({
  head: () => ({ meta: [{ title: "Miembros — Ganadero IA" }] }),
  component: MiembrosPage,
});

type Miembro = {
  id: string; rol: string; created_at: string; user_id: string;
  profile?: { nombre: string | null; email: string | null } | null;
};

const ROLES = ["propietario", "encargado", "operario", "asesor"] as const;

const rolConfig: Record<string, { label: string; icon: any; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  propietario: { label: "Propietario", icon: Crown, variant: "default" },
  encargado:   { label: "Encargado",   icon: Shield, variant: "secondary" },
  operario:    { label: "Operario",    icon: Wrench, variant: "outline" },
  asesor:      { label: "Asesor",      icon: BookOpen, variant: "outline" },
};

const rolDesc: Record<string, string> = {
  propietario: "Acceso total. Puede eliminar el establecimiento y gestionar miembros.",
  encargado:   "Puede registrar y editar toda la información productiva.",
  operario:    "Puede registrar eventos (pesadas, sanidad, etc.) pero no eliminar datos.",
  asesor:      "Solo lectura. Ideal para veterinarios o consultores externos.",
};

function MiembrosPage() {
  const { activeId, active } = useActiveEstablecimiento();
  if (!active) return <div className="p-8">Seleccioná un establecimiento.</div>;
  return <MiembrosInner estId={activeId!} estNombre={active.nombre} />;
}

function MiembrosInner({ estId, estNombre }: { estId: string; estNombre: string }) {
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRol, setCurrentRol] = useState<string | null>(null);

  // Invitar
  const [invOpen, setInvOpen] = useState(false);
  const [invEmail, setInvEmail] = useState("");
  const [invRol, setInvRol] = useState<string>("operario");
  const [invSaving, setInvSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data: user } = await supabase.auth.getUser();
    setCurrentUserId(user.user?.id ?? null);

    const { data } = await supabase
      .from("establecimiento_miembros")
      .select("id, rol, created_at, user_id, profile:profiles(nombre, email)")
      .eq("establecimiento_id", estId)
      .order("created_at");
    const items = ((data as unknown) as Miembro[]) ?? [];
    setMiembros(items);

    const myRol = items.find(m => m.user_id === user.user?.id)?.rol ?? null;
    setCurrentRol(myRol);
    setLoading(false);
  }

  useEffect(() => { load(); }, [estId]);

  const isPropietario = currentRol === "propietario";

  async function handleInvitar(e: React.FormEvent) {
    e.preventDefault();
    if (!invEmail.trim()) return;
    setInvSaving(true);

    // Buscar el user por email en profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, nombre, email")
      .eq("email", invEmail.trim().toLowerCase())
      .maybeSingle();

    if (!profile) {
      setInvSaving(false);
      toast.error(`No se encontró ningún usuario con el email "${invEmail}". El usuario debe estar registrado en el sistema primero.`);
      return;
    }

    // Verificar que no sea miembro ya
    const exists = miembros.some(m => m.user_id === profile.id);
    if (exists) {
      setInvSaving(false);
      toast.error("Ese usuario ya es miembro de este establecimiento.");
      return;
    }

    const { error } = await supabase.from("establecimiento_miembros").insert({
      establecimiento_id: estId,
      user_id: profile.id,
      rol: invRol as any,
    });

    setInvSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${profile.nombre ?? invEmail} agregado como ${rolConfig[invRol]?.label}`);
    setInvOpen(false); setInvEmail(""); setInvRol("operario");
    load();
  }

  async function cambiarRol(id: string, nuevoRol: string) {
    const { error } = await supabase.from("establecimiento_miembros").update({ rol: nuevoRol as any }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Rol actualizado");
    load();
  }

  async function eliminarMiembro(id: string) {
    const { error } = await supabase.from("establecimiento_miembros").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Miembro eliminado");
    load();
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Miembros</h1>
          <p className="text-muted-foreground text-sm">Usuarios con acceso a {estNombre}</p>
        </div>
        {isPropietario && (
          <Button onClick={() => setInvOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />Agregar miembro
          </Button>
        )}
      </div>

      {/* Descripción de roles */}
      <Card className="p-4 bg-muted/30">
        <div className="text-sm font-medium mb-3">Descripción de roles</div>
        <div className="grid md:grid-cols-2 gap-2">
          {ROLES.map((rol) => {
            const cfg = rolConfig[rol];
            const Ic = cfg.icon;
            return (
              <div key={rol} className="flex gap-2 text-sm">
                <Ic className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <span className="font-medium">{cfg.label}:</span>{" "}
                  <span className="text-muted-foreground">{rolDesc[rol]}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {miembros.map((m) => {
            const cfg = rolConfig[m.rol] ?? rolConfig.operario;
            const Ic = cfg.icon;
            const isMe = m.user_id === currentUserId;
            const displayName = m.profile?.nombre ?? m.profile?.email ?? m.user_id.slice(0, 8) + "…";
            return (
              <Card key={m.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {displayName}
                      {isMe && <span className="ml-2 text-xs text-muted-foreground">(vos)</span>}
                    </div>
                    {m.profile?.email && m.profile.nombre && (
                      <div className="text-xs text-muted-foreground truncate">{m.profile.email}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isPropietario && !isMe && m.rol !== "propietario" ? (
                    <Select value={m.rol} onValueChange={(v) => cambiarRol(m.id, v)}>
                      <SelectTrigger className="h-8 text-xs w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.filter(r => r !== "propietario").map(r => (
                          <SelectItem key={r} value={r}>{rolConfig[r].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant={cfg.variant} className="flex items-center gap-1 text-xs">
                      <Ic className="h-3 w-3" />{cfg.label}
                    </Badge>
                  )}

                  {isPropietario && !isMe && m.rol !== "propietario" && (
                    <ConfirmDelete
                      title={`¿Quitar a ${displayName}?`}
                      description="Perderá el acceso al establecimiento."
                      onConfirm={() => eliminarMiembro(m.id)}
                    />
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog invitar */}
      <Dialog open={invOpen} onOpenChange={setInvOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar miembro</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvitar} className="space-y-4">
            <div>
              <Label>Email del usuario *</Label>
              <Input
                type="email" required
                value={invEmail}
                onChange={(e) => setInvEmail(e.target.value)}
                placeholder="usuario@email.com"
              />
              <p className="text-xs text-muted-foreground mt-1">
                El usuario debe haberse registrado previamente en el sistema.
              </p>
            </div>
            <div>
              <Label>Rol</Label>
              <Select value={invRol} onValueChange={setInvRol}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.filter(r => r !== "propietario").map(r => (
                    <SelectItem key={r} value={r}>
                      {rolConfig[r].label} — {rolDesc[r].split(".")[0]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setInvOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={invSaving}>
                <UserPlus className="h-4 w-4 mr-2" />
                {invSaving ? "Buscando…" : "Agregar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
