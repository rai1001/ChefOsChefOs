import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ForecastXLSXImport } from "@/components/import/ForecastXLSXImport";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Coffee, TrendingUp, Users } from "lucide-react";
import { format, parseISO, isToday, isTomorrow, addDays, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { useForecasts, useUpcomingForecasts } from "@/hooks/useForecasts";

const Forecast = () => {
  const [historyDays] = useState(30);
  const today = new Date();
  const startDate = format(subDays(today, historyDays), "yyyy-MM-dd");
  const endDate = format(addDays(today, 30), "yyyy-MM-dd");

  const { data: upcomingForecasts = [] } = useUpcomingForecasts(7);
  const { data: historyForecasts = [] } = useForecasts({ startDate, endDate });

  const weekBreakfasts = upcomingForecasts.reduce((sum, item) => sum + (item.breakfast_pax ?? 0), 0);
  const weekOccupancy = upcomingForecasts.reduce((sum, item) => sum + (item.hotel_occupancy ?? 0), 0);
  const weekHalfBoard = upcomingForecasts.reduce((sum, item) => sum + (item.half_board_pax ?? 0), 0);
  const weekExtras = upcomingForecasts.reduce((sum, item) => sum + (item.extras_pax ?? 0), 0);

  const sortedHistory = [...historyForecasts].sort((a, b) =>
    b.forecast_date.localeCompare(a.forecast_date),
  );

  const getDayLabel = (dateIso: string) => {
    const date = parseISO(dateIso);
    if (isToday(date)) return "Hoy";
    if (isTomorrow(date)) return "Mañana";
    return format(date, "EEEE", { locale: es });
  };

  return (
    <MainLayout 
      title="Previsión de Desayunos"
      subtitle="Previsión de servicios basada en importación"
    >
      {/* Stats Summary */}
      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Coffee className="h-4 w-4" />
            Previsto semana
          </div>
          <p className="font-display text-2xl font-semibold">{weekBreakfasts}</p>
          <p className="text-xs text-muted-foreground">desayunos</p>
        </div>
        
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Users className="h-4 w-4" />
            Ocupación semana
          </div>
          <p className="font-display text-2xl font-semibold">{weekOccupancy}</p>
          <p className="text-xs text-muted-foreground">habitaciones</p>
        </div>
        
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            Media pensión
          </div>
          <p className="font-display text-2xl font-semibold">{weekHalfBoard}</p>
          <p className="text-xs text-muted-foreground">pax MP</p>
        </div>
        
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            Extras semana
          </div>
          <p className="font-display text-2xl font-semibold">
            {weekExtras}
          </p>
          <p className="text-xs text-muted-foreground">extras pax</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="font-display text-lg font-semibold">Próximos 7 días</h2>
        <div className="flex items-center gap-2">
          <ForecastXLSXImport />
          <Badge variant="outline" className="h-9 px-3 flex items-center">
            Métrica principal: desayunos
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 mb-8">
        {upcomingForecasts.map((forecast, index) => {
          const date = parseISO(forecast.forecast_date);
          return (
            <div
              key={forecast.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-300 hover:shadow-md animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium capitalize">{getDayLabel(forecast.forecast_date)}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(date, "d MMM", { locale: es })}
                  </p>
                </div>
                {isToday(date) && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    HOY
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Desayunos</span>
                  <span className="font-semibold text-primary">{forecast.breakfast_pax ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Ocupación</span>
                  <span className="font-medium">{forecast.hotel_occupancy ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">MP</span>
                  <span className="font-medium">{forecast.half_board_pax ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Extras</span>
                  <span className="font-medium">{forecast.extras_pax ?? 0}</span>
                </div>
              </div>
            </div>
          );
        })}
        {upcomingForecasts.length === 0 && (
          <div className="col-span-full flex h-40 items-center justify-center rounded-xl border border-dashed border-border">
            <div className="text-center">
              <Coffee className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-muted-foreground">No hay previsiones cargadas</p>
              <Button variant="link" size="sm" className="mt-2">
                <Upload className="h-4 w-4 mr-1" />
                Importar datos
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Historical Table */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="p-4 border-b border-border">
          <h3 className="font-display text-lg font-semibold">Histórico de Previsión</h3>
          <p className="text-sm text-muted-foreground">Desayunos y ocupación por fecha</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Ocupación</TableHead>
              <TableHead className="text-right">Desayunos</TableHead>
              <TableHead className="text-right">MP</TableHead>
              <TableHead className="text-right">Extras</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedHistory.slice(0, 30).map((forecast) => (
              <TableRow key={forecast.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {format(parseISO(forecast.forecast_date), "d MMM", { locale: es })}
                    </span>
                    {isToday(parseISO(forecast.forecast_date)) && (
                      <Badge variant="secondary" className="text-[10px]">Hoy</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">{forecast.hotel_occupancy ?? 0}</TableCell>
                <TableCell className="text-right font-medium text-primary">{forecast.breakfast_pax ?? 0}</TableCell>
                <TableCell className="text-right">{forecast.half_board_pax ?? 0}</TableCell>
                <TableCell className="text-right">{forecast.extras_pax ?? 0}</TableCell>
              </TableRow>
            ))}
            {sortedHistory.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No hay previsiones cargadas
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </MainLayout>
  );
};

export default Forecast;
