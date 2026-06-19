import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Beef,
  MapPinned,
  HeartPulse,
  Syringe,
  Scale,
  ArrowLeftRight,
  Bot,
  Sprout,
  Building2,
  Zap,
  LogOut,
  ChevronsUpDown,
  AlertTriangle,
  Wallet,
  Fence,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActiveEstablecimiento } from "@/hooks/use-establecimiento";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { ReactNode } from "react";

const NAV_GROUPS = [
  {
    label: "Operación",
    items: [
      { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/manga", icon: Zap, label: "Modo manga" },
    ],
  },
  {
    label: "Rodeo",
    items: [
      { to: "/animales", icon: Beef, label: "Animales" },
      { to: "/movimientos", icon: ArrowLeftRight, label: "Movimientos" },
      { to: "/pesadas", icon: Scale, label: "Pesadas" },
    ],
  },
  {
    label: "Producción",
    items: [
      { to: "/reproduccion", icon: HeartPulse, label: "Reproducción" },
      { to: "/sanidad", icon: Syringe, label: "Sanidad" },
      { to: "/potreros", icon: MapPinned, label: "Potreros" },
      { to: "/forrajes", icon: Sprout, label: "Forrajes" },
      { to: "/infraestructura", icon: Fence, label: "Infraestructura" },
    ],
  },
  {
    label: "Gestión",
    items: [
      { to: "/finanzas", icon: Wallet, label: "Finanzas" },
      { to: "/auditoria", icon: ScrollText, label: "Auditoría" },
    ],
  },
  {
    label: "Inteligencia",
    items: [
      { to: "/ia", icon: Bot, label: "IA Ganadera" },
      { to: "/establecimientos", icon: Building2, label: "Establecimientos" },
    ],
  },
] as const;

function EstablecimientoSwitcher() {
  const { establecimientos, active, setActiveId, loading } = useActiveEstablecimiento();
  if (loading) return null;
  if (establecimientos.length === 0) {
    return (
      <Link
        to="/establecimientos"
        className="flex items-center gap-2 px-3 py-2 mx-2 rounded-md bg-sidebar-accent text-sm text-sidebar-accent-foreground hover:bg-sidebar-accent/80"
      >
        <AlertTriangle className="h-4 w-4" />
        Crear establecimiento
      </Link>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-2 mx-2 rounded-md bg-sidebar-accent text-sm text-sidebar-accent-foreground hover:bg-sidebar-accent/80 w-[calc(100%-1rem)]">
          <Sprout className="h-4 w-4 text-sidebar-primary" />
          <div className="flex-1 text-left truncate">
            <div className="text-xs text-sidebar-foreground/60">Establecimiento</div>
            <div className="font-medium truncate">{active?.nombre ?? "Seleccionar"}</div>
          </div>
          <ChevronsUpDown className="h-4 w-4 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Tus campos</DropdownMenuLabel>
        {establecimientos.map((e) => (
          <DropdownMenuItem key={e.id} onSelect={() => setActiveId(e.id)}>
            {e.nombre}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/establecimientos">+ Nuevo establecimiento</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);
  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Sesión cerrada");
    navigate({ to: "/auth", replace: true });
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="justify-start w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <div className="h-7 w-7 rounded-full bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center text-xs font-semibold">
            {email?.[0]?.toUpperCase() ?? "U"}
          </div>
          <span className="truncate text-xs">{email ?? "Usuario"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleSignOut}>
          <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { location } = useRouterState();
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Link to="/dashboard" className="flex items-center gap-2 px-3 py-3 text-sidebar-foreground">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
              <Sprout className="h-4 w-4" />
            </span>
            <span className="font-semibold">Ganadero IA</span>
          </Link>
          <EstablecimientoSwitcher />
        </SidebarHeader>
        <SidebarContent>
          {NAV_GROUPS.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton asChild isActive={active}>
                          <Link to={item.to}>
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter>
          <UserMenu />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b border-border px-4 sticky top-0 bg-background/95 backdrop-blur z-10">
          <SidebarTrigger />
          <div className="flex-1" />
        </header>
        <main className="flex-1">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}