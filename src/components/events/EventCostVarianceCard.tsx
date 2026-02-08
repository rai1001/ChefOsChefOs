import { Badge } from "@/components/ui/badge";
import { EventCostVarianceRow } from "@/hooks/useEventCostVariance";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface EventCostVarianceCardProps {
  rows: EventCostVarianceRow[];
}

export function EventCostVarianceCard({ rows }: EventCostVarianceCardProps) {
  const topRows = [...rows]
    .sort((left, right) => Math.abs(right.delta_amount ?? 0) - Math.abs(left.delta_amount ?? 0))
    .slice(0, 3);

  const averageDelta =
    rows.length === 0
      ? 0
      : rows.reduce((sum, row) => sum + (row.delta_pct ?? 0), 0) / rows.length;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Desviación de coste (eventos)</h2>
          <p className="text-sm text-muted-foreground">
            Comparativa coste teórico vs real del periodo seleccionado.
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            averageDelta > 0
              ? "bg-destructive/10 text-destructive border-destructive/20"
              : "bg-success/10 text-success border-success/20",
          )}
        >
          {averageDelta > 0 ? "+" : ""}
          {averageDelta.toFixed(2)}%
        </Badge>
      </div>

      {topRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin datos de desviación todavía.</p>
      ) : (
        <div className="space-y-2">
          {topRows.map((row) => {
            const delta = row.delta_amount ?? 0;
            const positive = delta >= 0;
            return (
              <div
                key={row.event_id}
                className="flex items-center justify-between rounded-lg border border-border bg-background p-3"
              >
                <div>
                  <p className="text-sm font-medium">{row.event_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Base €{(row.baseline_cost_total ?? 0).toFixed(2)} · Real €{(row.actual_cost_total ?? 0).toFixed(2)}
                  </p>
                </div>
                <div
                  className={cn(
                    "flex items-center gap-1 text-sm font-medium",
                    positive ? "text-destructive" : "text-success",
                  )}
                >
                  {positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {positive ? "+" : ""}
                  {delta.toFixed(2)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
