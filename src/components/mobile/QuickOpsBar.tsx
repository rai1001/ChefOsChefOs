import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Package,
  Plus,
  Play,
  PlusCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { canUseQuickAction } from "@/lib/mobileRoutingGuards";
import { cn } from "@/lib/utils";

interface QuickActionItem {
  id: "receive_purchase" | "record_waste" | "new_task" | "start_task" | "complete_task";
  label: string;
  to: string;
  icon: typeof Package;
}

const QUICK_ACTIONS: QuickActionItem[] = [
  { id: "receive_purchase", label: "Recibir compra", to: "/purchases?quick=receive", icon: Package },
  { id: "record_waste", label: "Registrar merma", to: "/inventory?quick=waste", icon: AlertTriangle },
  { id: "new_task", label: "Nueva tarea", to: "/tasks?quick=new-task&service=breakfast", icon: PlusCircle },
  { id: "start_task", label: "Iniciar tarea", to: "/tasks?quick=start", icon: Play },
  { id: "complete_task", label: "Completar tarea", to: "/tasks?quick=complete", icon: CheckCircle2 },
];

export function QuickOpsBar() {
  const location = useLocation();
  const { roles, profile } = useAuth();
  const [open, setOpen] = useState(false);

  const role = roles[0] ?? "";
  const hasHotel = !!profile?.current_hotel_id;
  const isMobile = typeof window !== "undefined" ? window.matchMedia("(max-width: 1023px)").matches : false;

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  if (location.pathname.startsWith("/auth")) return null;
  if (!isMobile) return null;

  const availableActions = QUICK_ACTIONS.filter((item) =>
    canUseQuickAction(item.id, { isMobile, hasHotel, role }),
  );

  if (availableActions.length === 0) return null;

  return (
    <div className="fixed bottom-20 left-4 z-50 lg:hidden">
      <div className="flex flex-col items-end gap-2">
        {open && (
          <div className="flex flex-col items-end gap-2 rounded-2xl border border-border/60 bg-card/90 p-2 shadow-xl backdrop-blur">
            {availableActions.map((item, index) => (
              <Button
                key={item.id}
                asChild
                variant="outline"
                className="h-11 min-w-44 justify-start animate-fade-in"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <Link to={item.to}>
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Link>
              </Button>
            ))}
          </div>
        )}

        <Button
          type="button"
          size="icon"
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            "h-12 w-12 rounded-full shadow-lg",
            open ? "bg-secondary text-secondary-foreground hover:bg-secondary/90" : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
          aria-label={open ? "Cerrar acciones rapidas" : "Abrir acciones rapidas"}
        >
          {open ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
        </Button>
      </div>
    </div>
  );
}

