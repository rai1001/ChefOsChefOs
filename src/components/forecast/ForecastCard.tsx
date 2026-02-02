import { format, parseISO, isToday, isTomorrow, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { TrendingUp, TrendingDown, Minus, Coffee, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Forecast } from "@/lib/types";

interface ForecastCardProps {
  forecast: Forecast;
  delay?: number;
}

export function ForecastCard({ forecast, delay = 0 }: ForecastCardProps) {
  const date = parseISO(forecast.forecast_date);
  const hasActual = forecast.actual_breakfasts !== undefined;
  const delta = hasActual ? (forecast.actual_breakfasts! - forecast.breakfasts) : 0;
  const deltaPercent = hasActual && forecast.breakfasts > 0 
    ? Math.round((delta / forecast.breakfasts) * 100) 
    : 0;

  const getDayLabel = () => {
    if (isToday(date)) return "Hoy";
    if (isTomorrow(date)) return "Mañana";
    return format(date, "EEEE", { locale: es });
  };

  return (
    <div 
      className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-300 hover:shadow-md animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Date Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-medium capitalize">{getDayLabel()}</p>
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

      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-2">
        {/* Guests */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-secondary">
            <Users className="h-3.5 w-3.5 text-secondary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold leading-tight">{forecast.guests}</p>
            <p className="text-[9px] text-muted-foreground uppercase truncate">Huéspedes</p>
          </div>
        </div>

        {/* Breakfasts */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Coffee className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold leading-tight">{forecast.breakfasts}</p>
            <p className="text-[9px] text-muted-foreground uppercase truncate">Previstos</p>
          </div>
        </div>
      </div>

      {/* Actual vs Predicted */}
      {hasActual && (
        <div className={cn(
          "mt-3 flex items-center justify-between p-2 rounded-lg",
          delta > 0 ? "bg-success/10" : delta < 0 ? "bg-destructive/10" : "bg-muted"
        )}>
          <div className="flex items-center gap-2">
            {delta > 0 ? (
              <TrendingUp className="h-4 w-4 text-success" />
            ) : delta < 0 ? (
              <TrendingDown className="h-4 w-4 text-destructive" />
            ) : (
              <Minus className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">
              Real: {forecast.actual_breakfasts}
            </span>
          </div>
          <span className={cn(
            "text-sm font-medium",
            delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : "text-muted-foreground"
          )}>
            {delta > 0 ? "+" : ""}{delta} ({deltaPercent > 0 ? "+" : ""}{deltaPercent}%)
          </span>
        </div>
      )}

      {!hasActual && (
        <div className="mt-3 p-2 rounded-lg bg-muted/50 text-center">
          <span className="text-xs text-muted-foreground">Sin registro real</span>
        </div>
      )}
    </div>
  );
}
