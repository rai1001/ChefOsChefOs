import { Clock, ChefHat, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type OrderStatus = "pending" | "preparing" | "ready" | "completed";

interface OrderItem {
  name: string;
  quantity: number;
  notes?: string;
}

interface OrderCardProps {
  orderNumber: string;
  table: string;
  items: OrderItem[];
  status: OrderStatus;
  time: string;
  delay?: number;
  onStatusChange?: (status: OrderStatus) => void;
}

const statusConfig = {
  pending: {
    label: "Pendiente",
    color: "bg-warning/10 text-warning border-warning/20",
    icon: Clock,
  },
  preparing: {
    label: "Preparando",
    color: "bg-info/10 text-info border-info/20",
    icon: ChefHat,
  },
  ready: {
    label: "Listo",
    color: "bg-success/10 text-success border-success/20",
    icon: CheckCircle2,
  },
  completed: {
    label: "Completado",
    color: "bg-muted text-muted-foreground border-muted",
    icon: CheckCircle2,
  },
};

export function OrderCard({ 
  orderNumber, 
  table, 
  items, 
  status, 
  time,
  delay = 0,
  onStatusChange 
}: OrderCardProps) {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const getNextStatus = (): OrderStatus | null => {
    switch (status) {
      case "pending": return "preparing";
      case "preparing": return "ready";
      case "ready": return "completed";
      default: return null;
    }
  };

  const nextStatus = getNextStatus();

  return (
    <div 
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-all duration-300 hover:shadow-lg animate-fade-in",
        status === "pending" && "border-warning/30",
        status === "preparing" && "border-info/30",
        status === "ready" && "border-success/30 animate-pulse-soft"
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-display text-lg font-semibold text-foreground">
            #{orderNumber}
          </span>
          <Badge variant="outline" className="font-medium">
            {table}
          </Badge>
        </div>
        <Badge className={cn("gap-1.5 border", config.color)}>
          <StatusIcon className="h-3.5 w-3.5" />
          {config.label}
        </Badge>
      </div>

      {/* Items */}
      <div className="mt-4 space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center justify-between text-sm">
            <span className="text-foreground">
              <span className="font-medium text-primary">{item.quantity}x</span> {item.name}
            </span>
            {item.notes && (
              <span className="text-xs text-muted-foreground italic">
                {item.notes}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{time}</span>
        </div>
        {nextStatus && onStatusChange && (
          <Button 
            size="sm" 
            variant={status === "ready" ? "default" : "secondary"}
            onClick={() => onStatusChange(nextStatus)}
            className="transition-transform hover:scale-105"
          >
            {status === "pending" && "Iniciar"}
            {status === "preparing" && "Listo"}
            {status === "ready" && "Entregar"}
          </Button>
        )}
      </div>
    </div>
  );
}
