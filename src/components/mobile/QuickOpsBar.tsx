import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Package, AlertTriangle, Play, CheckCircle2, PlusCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { canUseQuickAction } from "@/lib/mobileRoutingGuards";

export function QuickOpsBar() {
  const location = useLocation();
  const { roles, profile } = useAuth();
  const role = roles[0] ?? "";
  const hasHotel = !!profile?.current_hotel_id;
  const isMobile = typeof window !== "undefined" ? window.matchMedia("(max-width: 1023px)").matches : false;

  if (location.pathname.startsWith("/auth")) return null;
  if (!isMobile) return null;

  const canReceive = canUseQuickAction("receive_purchase", { isMobile, hasHotel, role });
  const canWaste = canUseQuickAction("record_waste", { isMobile, hasHotel, role });
  const canNewTask = canUseQuickAction("new_task", { isMobile, hasHotel, role });
  const canStart = canUseQuickAction("start_task", { isMobile, hasHotel, role });
  const canComplete = canUseQuickAction("complete_task", { isMobile, hasHotel, role });

  if (!canReceive && !canWaste && !canNewTask && !canStart && !canComplete) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur px-3 py-2 lg:hidden">
      <div className="mx-auto flex max-w-2xl items-center justify-center gap-2">
        {canReceive && (
          <Button asChild size="sm" variant="outline" className="flex-1">
            <Link to="/purchases?quick=receive">
              <Package className="h-4 w-4 mr-1" />
              Recibir
            </Link>
          </Button>
        )}
        {canWaste && (
          <Button asChild size="sm" variant="outline" className="flex-1">
            <Link to="/inventory?quick=waste">
              <AlertTriangle className="h-4 w-4 mr-1" />
              Merma
            </Link>
          </Button>
        )}
        {canNewTask && (
          <Button asChild size="sm" variant="outline" className="flex-1">
            <Link to="/tasks?quick=new-task&service=breakfast">
              <PlusCircle className="h-4 w-4 mr-1" />
              Tarea
            </Link>
          </Button>
        )}
        {canStart && (
          <Button asChild size="sm" variant="outline" className="flex-1">
            <Link to="/tasks?quick=start">
              <Play className="h-4 w-4 mr-1" />
              Iniciar
            </Link>
          </Button>
        )}
        {canComplete && (
          <Button asChild size="sm" variant="outline" className="flex-1">
            <Link to="/tasks?quick=complete">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Completar
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
