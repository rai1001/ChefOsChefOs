import { useEffect, useState } from "react";
import { Bell, Search, LogOut, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { HotelSelector } from "@/components/settings/HotelSelector";
import { usePriorityNotifications } from "@/hooks/usePriorityNotifications";
import { useAlertSubscriptions } from "@/hooks/useAlertSubscriptions";
import { useTheme } from "next-themes";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { profile, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { data: priorityNotifications = [] } = usePriorityNotifications();
  const { data: alertSubscriptions = [] } = useAlertSubscriptions();
  const enabledEmailNotifications = alertSubscriptions.some((subscription) => subscription.enabled);
  const criticalNotificationCount = priorityNotifications.filter((notification) => notification.level === "critical").length;

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: "Administrador",
      jefe_cocina: "Jefe de Cocina",
      maitre: "Maître",
      produccion: "Producción",
      rrhh: "RRHH",
    };
    return labels[role] || role;
  };

  const notificationTone = (level: "critical" | "medium" | "low") => {
    if (level === "critical") return "border-destructive/30 bg-destructive/10 text-destructive";
    if (level === "medium") return "border-warning/30 bg-warning/10 text-warning";
    return "border-border bg-muted/40 text-foreground";
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div>
        <h1 className="font-display text-xl font-semibold text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Hotel Selector */}
        <HotelSelector />

        {/* Search */}
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar..."
            className="w-56 pl-10 h-9 text-sm focus-visible:ring-primary"
          />
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setTheme((resolvedTheme ?? theme) === "dark" ? "light" : "dark")}
          aria-label="Cambiar modo de color"
        >
          {mounted && (resolvedTheme ?? theme) === "dark" ? (
            <Sun className="h-4 w-4 text-warning" />
          ) : (
            <Moon className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className="h-4 w-4 text-muted-foreground" />
              {priorityNotifications.length > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                  {Math.min(priorityNotifications.length, 9)}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Notificaciones</span>
              {criticalNotificationCount > 0 && (
                <Badge variant="destructive" className="h-5">{criticalNotificationCount} criticas</Badge>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {priorityNotifications.length === 0 ? (
              <div className="px-2 py-3 text-sm text-muted-foreground">
                Sin alertas prioritarias asignadas.
              </div>
            ) : (
              <div className="space-y-2 px-2 py-2">
                {priorityNotifications.slice(0, 4).map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => navigate(notification.ctaTo)}
                    className={`w-full rounded-md border px-2 py-2 text-left transition-colors hover:bg-muted ${notificationTone(notification.level)}`}
                  >
                    <p className="text-xs font-medium">{notification.title}</p>
                    <p className="text-[11px] opacity-80">{notification.detail}</p>
                  </button>
                ))}
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              Email operativo: {enabledEmailNotifications ? "activo" : "inactivo"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              Push/WhatsApp: opcional (configurable)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2 h-9">
              <Avatar className="h-8 w-8 border-2 border-primary/20">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                  {getInitials(profile?.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left md:block">
                <p className="text-xs font-medium">{profile?.full_name || profile?.email || "Usuario"}</p>
                <p className="text-[10px] text-muted-foreground">
                  {roles.length > 0 ? getRoleLabel(roles[0]) : "Sin rol"}
                </p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              Configuración
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleSignOut}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar Sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
