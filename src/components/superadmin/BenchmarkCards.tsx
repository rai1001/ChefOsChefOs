import { Badge } from "@/components/ui/badge";
import { RankedBenchmark } from "@/lib/superAdminBenchmarks";

interface BenchmarkCardsProps {
  rows: RankedBenchmark[];
}

export function BenchmarkCards({ rows }: BenchmarkCardsProps) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        No hay datos de benchmark disponibles.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {rows.slice(0, 3).map((row, index) => (
        <div key={row.hotel_id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-medium">{row.hotel_name}</h3>
            <Badge variant={index === 0 ? "default" : "outline"}>#{index + 1}</Badge>
          </div>
          <p className="text-2xl font-semibold">{row.score.toFixed(2)}</p>
          <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
            <p>Coste/PAX: €{row.cost_per_pax_30d.toFixed(2)}</p>
            <p>Merma: {row.waste_qty_30d.toFixed(2)}</p>
            <p>Tareas: {row.task_completion_pct_30d.toFixed(2)}%</p>
            <p>Compras a tiempo: {row.purchase_on_time_pct_30d.toFixed(2)}%</p>
          </div>
        </div>
      ))}
    </div>
  );
}
