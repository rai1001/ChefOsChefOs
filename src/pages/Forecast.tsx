import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ForecastCard } from "@/components/forecast/ForecastCard";
import { ForecastXLSXImport } from "@/components/import/ForecastXLSXImport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TrendingUp, TrendingDown, Coffee, Save, Upload } from "lucide-react";
import { format, parseISO, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { forecastsStore, getUpcomingForecasts, getWeekForecasts } from "@/lib/stores";
import { useToast } from "@/hooks/use-toast";

const Forecast = () => {
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [actualValue, setActualValue] = useState<string>("");
  const { toast } = useToast();

  // Forecast import is now handled directly by the component

  const allForecasts = forecastsStore.getAll();
  const upcomingForecasts = getUpcomingForecasts(7);
  const weekForecasts = getWeekForecasts();
  
  // Calculate stats
  const weekTotal = weekForecasts.reduce((sum, f) => sum + f.breakfasts, 0);
  const weekActual = weekForecasts.reduce((sum, f) => sum + (f.actual_breakfasts || 0), 0);
  const weekDelta = weekForecasts
    .filter(f => f.actual_breakfasts !== undefined)
    .reduce((sum, f) => sum + (f.actual_breakfasts! - f.breakfasts), 0);
  
  const avgAccuracy = weekForecasts.filter(f => f.actual_breakfasts !== undefined).length > 0
    ? Math.round(100 - Math.abs(weekDelta / weekForecasts.filter(f => f.actual_breakfasts !== undefined).length))
    : null;

  const handleSaveActual = () => {
    const value = parseInt(actualValue);
    if (!isNaN(value) && selectedDate) {
      const forecast = allForecasts.find(f => f.forecast_date === selectedDate);
      if (forecast) {
        forecastsStore.update(forecast.id, {
          actual_breakfasts: value,
          delta: value - forecast.breakfasts
        });
        setIsRegisterOpen(false);
        setActualValue("");
      }
    }
  };

  const forecastsWithDelta = allForecasts
    .filter(f => f.actual_breakfasts !== undefined)
    .sort((a, b) => b.forecast_date.localeCompare(a.forecast_date));

  return (
    <MainLayout 
      title="Previsión de Desayunos" 
      subtitle="Ocupación y servicios previstos vs reales"
    >
      {/* Stats Summary */}
      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Coffee className="h-4 w-4" />
            Previsto semana
          </div>
          <p className="font-display text-2xl font-semibold">{weekTotal}</p>
          <p className="text-xs text-muted-foreground">desayunos</p>
        </div>
        
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            Real registrado
          </div>
          <p className="font-display text-2xl font-semibold">{weekActual}</p>
          <p className="text-xs text-muted-foreground">desayunos</p>
        </div>
        
        <div className={cn(
          "rounded-xl border p-4 shadow-sm",
          weekDelta > 0 ? "border-success/30 bg-success/5" : 
          weekDelta < 0 ? "border-destructive/30 bg-destructive/5" : 
          "border-border bg-card"
        )}>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            {weekDelta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            Delta semana
          </div>
          <p className={cn(
            "font-display text-2xl font-semibold",
            weekDelta > 0 ? "text-success" : weekDelta < 0 ? "text-destructive" : ""
          )}>
            {weekDelta > 0 ? "+" : ""}{weekDelta}
          </p>
          <p className="text-xs text-muted-foreground">diferencia</p>
        </div>
        
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            Precisión
          </div>
          <p className="font-display text-2xl font-semibold">
            {avgAccuracy !== null ? `${avgAccuracy}%` : "—"}
          </p>
          <p className="text-xs text-muted-foreground">promedio</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="font-display text-lg font-semibold">Próximos 7 días</h2>
        <div className="flex items-center gap-2">
          <ForecastXLSXImport />
          <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9">
                <Save className="h-4 w-4 mr-2" />
                Registrar real
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar desayunos reales</DialogTitle>
                <DialogDescription>
                  Ingresa el número real de desayunos servidos
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="date">Fecha</Label>
                  <Input
                    id="date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="actual">Desayunos servidos</Label>
                  <Input
                    id="actual"
                    type="number"
                    placeholder="Ej: 95"
                    value={actualValue}
                    onChange={(e) => setActualValue(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsRegisterOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveActual}>Guardar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Forecast Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 mb-8">
        {upcomingForecasts.map((forecast, index) => (
          <ForecastCard
            key={forecast.id}
            forecast={forecast}
            delay={index * 50}
          />
        ))}
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

      {/* Delta History Table */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="p-4 border-b border-border">
          <h3 className="font-display text-lg font-semibold">Histórico Delta (Previsto vs Real)</h3>
          <p className="text-sm text-muted-foreground">Comparativa de previsiones con registros reales</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Huéspedes</TableHead>
              <TableHead className="text-right">Previsto</TableHead>
              <TableHead className="text-right">Real</TableHead>
              <TableHead className="text-right">Delta</TableHead>
              <TableHead className="text-right">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {forecastsWithDelta.slice(0, 10).map((forecast) => {
              const delta = forecast.actual_breakfasts! - forecast.breakfasts;
              const deltaPercent = forecast.breakfasts > 0 
                ? Math.round((delta / forecast.breakfasts) * 100) 
                : 0;
              
              return (
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
                  <TableCell className="text-right">{forecast.guests}</TableCell>
                  <TableCell className="text-right">{forecast.breakfasts}</TableCell>
                  <TableCell className="text-right font-medium">{forecast.actual_breakfasts}</TableCell>
                  <TableCell className={cn(
                    "text-right font-medium",
                    delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : ""
                  )}>
                    {delta > 0 ? "+" : ""}{delta}
                  </TableCell>
                  <TableCell className={cn(
                    "text-right",
                    delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : ""
                  )}>
                    {deltaPercent > 0 ? "+" : ""}{deltaPercent}%
                  </TableCell>
                </TableRow>
              );
            })}
            {forecastsWithDelta.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No hay registros con datos reales
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
