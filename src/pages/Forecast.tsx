import { useMemo, useState } from "react";
import { addDays, format, isToday, isTomorrow, parseISO, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, Coffee, Loader2, TrendingUp, Users } from "lucide-react";
import { ForecastXLSXImport } from "@/components/import/ForecastXLSXImport";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useForecasts } from "@/hooks/useForecasts";
import { useProductionLoadAlerts } from "@/hooks/useProductionLoadAlerts";
import { cn } from "@/lib/utils";

const HORIZON_OPTIONS = [7, 14, 30] as const;
type HorizonDays = (typeof HORIZON_OPTIONS)[number];

function getDayLabel(dateIso: string) {
  const date = parseISO(dateIso);
  if (isToday(date)) return "Hoy";
  if (isTomorrow(date)) return "Manana";
  return format(date, "EEE", { locale: es });
}

function formatLoadSeverityTone(severity: "critical" | "medium" | "low") {
  if (severity === "critical") return "bg-destructive/10 text-destructive border-destructive/20";
  if (severity === "medium") return "bg-warning/10 text-warning border-warning/20";
  return "bg-muted text-muted-foreground border-border";
}

const Forecast = () => {
  const [horizonDays, setHorizonDays] = useState<HorizonDays>(14);
  const today = new Date();
  const compactStart = format(today, "yyyy-MM-dd");
  const compactEnd = format(addDays(today, horizonDays), "yyyy-MM-dd");
  const historyStart = format(subDays(today, 30), "yyyy-MM-dd");
  const historyEnd = format(addDays(today, 30), "yyyy-MM-dd");

  const compactQuery = useForecasts({ startDate: compactStart, endDate: compactEnd });
  const historyQuery = useForecasts({ startDate: historyStart, endDate: historyEnd });
  const overloadQuery = useProductionLoadAlerts({ days: horizonDays });

  const compactForecasts = compactQuery.data;
  const historyForecasts = historyQuery.data;
  const overloadAlerts = overloadQuery.data ?? [];

  const summary = useMemo(() => {
    const rows = compactForecasts ?? [];
    return rows.reduce(
      (acc, row) => {
        acc.breakfasts += row.breakfast_pax ?? 0;
        acc.occupancy += row.hotel_occupancy ?? 0;
        acc.halfBoard += row.half_board_pax ?? 0;
        acc.extras += row.extras_pax ?? 0;
        return acc;
      },
      { breakfasts: 0, occupancy: 0, halfBoard: 0, extras: 0 },
    );
  }, [compactForecasts]);

  const sortedHistory = useMemo(
    () => [...(historyForecasts ?? [])].sort((a, b) => b.forecast_date.localeCompare(a.forecast_date)),
    [historyForecasts],
  );

  const isLoading = compactQuery.isLoading || historyQuery.isLoading || overloadQuery.isLoading;

  if (isLoading) {
    return (
      <MainLayout title="Prevision" subtitle="Control de ocupacion y desayunos">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Prevision" subtitle="Vista compacta + alertas de sobrecarga por franja">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Coffee className="h-4 w-4" />
              Desayunos ({horizonDays}d)
            </div>
            <p className="mt-1 font-display text-2xl font-semibold">{summary.breakfasts}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              Ocupacion ({horizonDays}d)
            </div>
            <p className="mt-1 font-display text-2xl font-semibold">{summary.occupancy}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Media pension
            </div>
            <p className="mt-1 font-display text-2xl font-semibold">{summary.halfBoard}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              Extras de servicio
            </div>
            <p className="mt-1 font-display text-2xl font-semibold">{summary.extras}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-border p-1">
            {HORIZON_OPTIONS.map((option) => (
              <Button
                key={option}
                size="sm"
                variant={horizonDays === option ? "default" : "ghost"}
                onClick={() => setHorizonDays(option)}
              >
                {option} dias
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <ForecastXLSXImport />
            <Badge variant="outline">Modo compacto</Badge>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h3 className="font-display text-lg font-semibold">Alertas de sobrecarga por franja</h3>
            <Badge variant={overloadAlerts.length > 0 ? "destructive" : "secondary"}>
              {overloadAlerts.length}
            </Badge>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2">
            {overloadAlerts.length === 0 ? (
              <div className="rounded-lg border border-success/20 bg-success/5 p-4 text-sm text-success">
                Sin sobrecargas previstas en la ventana seleccionada.
              </div>
            ) : (
              overloadAlerts.slice(0, 6).map((alert) => (
                <div key={alert.id} className={cn("rounded-lg border p-3", formatLoadSeverityTone(alert.severity))}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {format(parseISO(alert.date), "EEE d MMM", { locale: es })} - {alert.shift}
                    </p>
                    <Badge variant="outline">{alert.loadPct}%</Badge>
                  </div>
                  <p className="mt-1 text-xs opacity-80">{alert.detail}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="p-4 border-b border-border">
            <h3 className="font-display text-lg font-semibold">Prevision compacta ({horizonDays} dias)</h3>
            <p className="text-sm text-muted-foreground">Vista operacional rapida para compra y produccion.</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dia</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Ocupacion</TableHead>
                <TableHead className="text-right">Desayunos</TableHead>
                <TableHead className="text-right">MP</TableHead>
                <TableHead className="text-right">Extras</TableHead>
                <TableHead className="text-right">Carga</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(compactForecasts ?? []).length > 0 ? (
                (compactForecasts ?? []).map((forecast) => {
                  const occupancy = forecast.hotel_occupancy ?? 0;
                  const breakfasts = forecast.breakfast_pax ?? 0;
                  const loadPct = occupancy > 0 ? Math.round((breakfasts / occupancy) * 100) : 0;
                  return (
                    <TableRow key={forecast.id}>
                      <TableCell className="font-medium">{getDayLabel(forecast.forecast_date)}</TableCell>
                      <TableCell>{format(parseISO(forecast.forecast_date), "d MMM", { locale: es })}</TableCell>
                      <TableCell className="text-right">{occupancy}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">{breakfasts}</TableCell>
                      <TableCell className="text-right">{forecast.half_board_pax ?? 0}</TableCell>
                      <TableCell className="text-right">{forecast.extras_pax ?? 0}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[11px]",
                            loadPct >= 95 && "border-warning text-warning",
                            loadPct >= 120 && "border-destructive text-destructive",
                          )}
                        >
                          {loadPct}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <AlertTriangle className="h-6 w-6 opacity-40" />
                      <p>No hay previsiones en el rango seleccionado.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="p-4 border-b border-border">
            <h3 className="font-display text-lg font-semibold">Historico de prevision</h3>
            <p className="text-sm text-muted-foreground">Ultimos 30 dias + ventana futura.</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Ocupacion</TableHead>
                <TableHead className="text-right">Desayunos</TableHead>
                <TableHead className="text-right">MP</TableHead>
                <TableHead className="text-right">Extras</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedHistory.slice(0, 40).map((forecast) => (
                <TableRow key={forecast.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {format(parseISO(forecast.forecast_date), "d MMM", { locale: es })}
                      </span>
                      {isToday(parseISO(forecast.forecast_date)) && (
                        <Badge variant="secondary" className="text-[10px]">
                          Hoy
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{forecast.hotel_occupancy ?? 0}</TableCell>
                  <TableCell className="text-right font-medium text-primary">{forecast.breakfast_pax ?? 0}</TableCell>
                  <TableCell className="text-right">{forecast.half_board_pax ?? 0}</TableCell>
                  <TableCell className="text-right">{forecast.extras_pax ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </MainLayout>
  );
};

export default Forecast;
