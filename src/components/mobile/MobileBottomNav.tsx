import { Link, useLocation } from "react-router-dom";
import {
  Calendar,
  Home,
  Package,
  ShoppingCart,
  UserCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface MobileNavItem {
  label: string;
  to: string;
  icon: typeof Home;
  allowedRoles: string[] | null;
}

const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { label: "Inicio", to: "/", icon: Home, allowedRoles: null },
  { label: "Eventos", to: "/events", icon: Calendar, allowedRoles: ["admin", "jefe_cocina", "maitre"] },
  { label: "Compras", to: "/purchases", icon: ShoppingCart, allowedRoles: ["admin", "jefe_cocina"] },
  { label: "Stock", to: "/inventory", icon: Package, allowedRoles: ["admin", "jefe_cocina", "produccion"] },
  { label: "Mi turno", to: "/my-shift", icon: UserCircle2, allowedRoles: null },
];

function isPathActive(currentPath: string, to: string) {
  if (to === "/") return currentPath === "/";
  return currentPath.startsWith(to);
}

export function MobileBottomNav() {
  const location = useLocation();
  const { roles } = useAuth();
  const isMobile = typeof window !== "undefined" ? window.matchMedia("(max-width: 1023px)").matches : false;

  if (!isMobile) return null;
  if (location.pathname.startsWith("/auth")) return null;

  const items = MOBILE_NAV_ITEMS.filter((item) => {
    if (!item.allowedRoles) return true;
    return item.allowedRoles.some((role) => roles.includes(role as (typeof roles)[number]));
  });

  if (items.length === 0) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur lg:hidden">
      <div
        className="mx-auto grid max-w-2xl gap-1 rounded-2xl border border-border/60 bg-card/80 p-1 shadow-lg"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const active = isPathActive(location.pathname, item.to);

          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center rounded-xl px-2 py-1 text-[11px] transition-colors",
                active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/60",
              )}
            >
              <item.icon className="mb-0.5 h-4 w-4" />
              <span className="leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
