import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  ChefHat, 
  LayoutDashboard, 
  Calendar,
  TrendingUp,
  UtensilsCrossed,
  Package,
  ShoppingCart,
  Warehouse,
  ClipboardList,
  Ticket,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Shield,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const getMenuItems = (isSuperAdmin: boolean, canOperations: boolean) => {
  const items = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/" },
    { icon: Calendar, label: "Eventos", path: "/events" },
    { icon: TrendingUp, label: "Previsión", path: "/forecast" },
    { icon: UtensilsCrossed, label: "Menús", path: "/menus" },
    { icon: Package, label: "Productos", path: "/products" },
    { icon: ShoppingCart, label: "Compras", path: "/purchases" },
    { icon: Warehouse, label: "Inventario", path: "/inventory" },
    { icon: ClipboardList, label: "Tareas", path: "/tasks" },
    { icon: Ticket, label: "Tickets", path: "/tickets" },
    { icon: User, label: "Mi Turno", path: "/my-shift" },
    { icon: Calendar, label: "Plan Diario", path: "/daily-plan" },
    { icon: Clock, label: "Turnos", path: "/shifts" },
    { icon: Users, label: "Personal", path: "/staff" },
    { icon: Settings, label: "Ajustes", path: "/settings" },
  ];

  if (canOperations) {
    items.push({ icon: Activity, label: "Operacion 24/7", path: "/operations" });
  }
  
  if (isSuperAdmin) {
    items.push({ icon: Activity, label: "Estado 24/7", path: "/status" });
    items.push({ icon: Shield, label: "Super Admin", path: "/super-admin" });
  }
  
  return items;
};

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes('super_admin');
  const canOperations =
    isSuperAdmin ||
    roles.includes("admin") ||
    roles.includes("jefe_cocina") ||
    roles.includes("produccion") ||
    roles.includes("rrhh");
  const menuItems = getMenuItems(isSuperAdmin, canOperations);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300 ease-in-out hidden lg:flex flex-col",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4 flex-shrink-0">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <ChefHat className="h-6 w-6 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in">
              <h1 className="font-display text-lg font-semibold text-sidebar-foreground">
                ChefOs
              </h1>
              <p className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wider">Gestión Cocina</p>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto space-y-0.5 px-2 py-4">
        {menuItems.map((item, index) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <item.icon className={cn(
                "h-5 w-5 flex-shrink-0 transition-transform duration-200",
                !isActive && "group-hover:scale-110"
              )} />
              {!collapsed && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-2 flex-shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-sidebar-foreground/70 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5" />
              <span className="flex-1 text-left text-sm font-medium">Colapsar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
