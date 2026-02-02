import { AlertTriangle, Package, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface InventoryItemProps {
  name: string;
  category: string;
  currentStock: number;
  maxStock: number;
  unit: string;
  trend?: "up" | "down" | "stable";
  delay?: number;
}

export function InventoryItem({
  name,
  category,
  currentStock,
  maxStock,
  unit,
  trend = "stable",
  delay = 0,
}: InventoryItemProps) {
  const percentage = (currentStock / maxStock) * 100;
  const isLow = percentage < 25;
  const isCritical = percentage < 10;

  return (
    <div 
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition-all duration-300 hover:shadow-md animate-fade-in",
        isCritical && "border-destructive/30 bg-destructive/5",
        isLow && !isCritical && "border-warning/30"
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            isCritical ? "bg-destructive/10 text-destructive" : 
            isLow ? "bg-warning/10 text-warning" : 
            "bg-primary/10 text-primary"
          )}>
            <Package className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-medium text-foreground">{name}</h4>
            <p className="text-xs text-muted-foreground">{category}</p>
          </div>
        </div>

        {isCritical && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Crítico
          </Badge>
        )}
        {isLow && !isCritical && (
          <Badge variant="secondary" className="gap-1 bg-warning/10 text-warning">
            <AlertTriangle className="h-3 w-3" />
            Bajo
          </Badge>
        )}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">
            {currentStock} <span className="text-muted-foreground">{unit}</span>
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            {trend === "up" && <TrendingUp className="h-4 w-4 text-success" />}
            {trend === "down" && <TrendingDown className="h-4 w-4 text-destructive" />}
            {Math.round(percentage)}%
          </span>
        </div>
        <Progress 
          value={percentage} 
          className={cn(
            "mt-2 h-2",
            isCritical && "[&>div]:bg-destructive",
            isLow && !isCritical && "[&>div]:bg-warning"
          )} 
        />
      </div>
    </div>
  );
}
