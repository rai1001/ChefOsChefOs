import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  Calendar, 
  CheckCircle2, 
  ChevronRight, 
  Clock, 
  Coffee, 
  Package,
  Users,
  ClipboardList,
  Flame,
  ArrowUpRight,
  Loader2,
  Truck,
  ShoppingCart
} from "lucide-react";
import { Link } from "react-router-dom";
import { format, parseISO, differenceInDays, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { 
  useDashboardStats,
  useUpcomingEvents,
  useExpiringLots,
  usePendingTasks
} from "@/hooks/useDashboard";
import { useUpcomingForecasts } from "@/hooks/useForecasts";
import { usePendingDeliveries, useIncompleteDeliveries } from "@/hooks/usePurchases";
import { ForecastXLSXImport } from "@/components/import/ForecastXLSXImport";

const Dashboard = () => {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: upcomingEvents = [] } = useUpcomingEvents(7);
  const { data: expiringLots = [] } = useExpiringLots(7);
  const { data: pendingTasks = [] } = usePendingTasks();
  const { data: forecasts = [] } = useUpcomingForecasts(7);
  const { data: pendingDeliveries } = usePendingDeliveries();
  const { data: incompleteDeliveries = [] } = useIncompleteDeliveries();

  const weeklyBreakfasts = forecasts.reduce((sum, f) => sum + (f.breakfast_pax || 0), 0);
  const totalUpcomingPax = upcomingEvents.reduce((sum, e) => sum + (e.pax || 0), 0);
  const criticalAlerts = expiringLots.filter(lot => {
    const days = differenceInDays(new Date(lot.expiry_date!), new Date());
    return days <= 2;
  }).length;
  const tasksInProgress = pendingTasks.filter(t => t.status === "in_progress").length;
  const tasksPending = pendingTasks.filter(t => t.status === "pending").length;
  
  const lateDeliveries = pendingDeliveries?.late?.length || 0;
  const todayDeliveries = pendingDeliveries?.today?.length || 0;
  const totalAlerts = criticalAlerts + lateDeliveries + incompleteDeliveries.length;

  if (statsLoading) {
    return (
      <MainLayout title="Dashboard" subtitle="Vista general de operaciones">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title="Dashboard" 
      subtitle="Vista general de operaciones"
    >
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {/* Alerts */}
        <Link to="/purchases" className={cn(
          "rounded-xl border p-4 shadow-sm transition-all hover:shadow-md",
          totalAlerts > 0 
            ? "border-destructive/30 bg-destructive/5" 
            : "border-border bg-card"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className={cn(
                "h-5 w-5",
                totalAlerts > 0 ? "text-destructive animate-pulse" : "text-destructive/50"
              )} />
            </div>
            {totalAlerts > 0 && (
              <Badge variant="destructive">{totalAlerts}</Badge>
            )}
          </div>
          <p className="mt-3 font-display text-2xl font-semibold">{totalAlerts}</p>
          <p className="text-sm text-muted-foreground">Alertas activas</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {lateDeliveries > 0 && (
              <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">
                {lateDeliveries} pedidos tarde
              </Badge>
            )}
            {incompleteDeliveries.length > 0 && (
              <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20">
                {incompleteDeliveries.length} incompletos
              </Badge>
            )}
            {criticalAlerts > 0 && (
              <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">
                {criticalAlerts} caducidades
              </Badge>
            )}
          </div>
        </Link>

        {/* Tasks */}
        <Link to="/tasks" className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
              <ClipboardList className="h-5 w-5 text-info" />
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-3 font-display text-2xl font-semibold">{pendingTasks.length}</p>
          <p className="text-sm text-muted-foreground">Tareas (7d)</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20">
              {tasksInProgress} en curso
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {tasksPending} pendientes
            </Badge>
          </div>
        </Link>

        {/* Breakfast Forecast */}
        <Link to="/forecast" className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Coffee className="h-5 w-5 text-primary" />
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-3 font-display text-2xl font-semibold">{weeklyBreakfasts}</p>
          <p className="text-sm text-muted-foreground">Desayunos (7d)</p>
          <p className="text-xs text-muted-foreground mt-1">
            Previsión próxima semana
          </p>
        </Link>

        {/* Upcoming Events (current month) */}
        <Link to="/events" className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20">
              <Calendar className="h-5 w-5 text-accent-foreground" />
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-3 font-display text-2xl font-semibold">{upcomingEvents.length}</p>
          <p className="text-sm text-muted-foreground">Eventos (mes)</p>
          <p className="text-xs text-muted-foreground mt-1">
            {totalUpcomingPax} personas en total
          </p>
        </Link>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Forecasts 7 días */}
        <div className="space-y-6">
          {/* Previsión Desayunos 7 días */}
          <div className="rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-display text-lg font-semibold">Previsión 7 días</h3>
              <ForecastXLSXImport />
            </div>
            <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
              {forecasts.length > 0 ? (
                forecasts.map((forecast, index) => {
                  const date = new Date(forecast.forecast_date);
                  const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                  return (
                    <div 
                      key={forecast.id}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-lg animate-fade-in",
                        isToday ? "bg-primary/10" : "bg-muted/50"
                      )}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-center gap-2">
                        <Coffee className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">
                            {format(date, "EEE d", { locale: es })}
                            {isToday && <Badge variant="secondary" className="ml-2 text-[10px]">Hoy</Badge>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {forecast.hotel_occupancy || 0} habs
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary">{forecast.breakfast_pax || 0}</p>
                        <p className="text-[10px] text-muted-foreground">desayunos</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                  <Coffee className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">Sin previsiones cargadas</p>
                  <p className="text-xs">Importa desde Excel</p>
                </div>
              )}
            </div>
            <div className="p-3 border-t border-border">
              <Link to="/forecast">
                <Button variant="ghost" size="sm" className="w-full text-xs">
                  Ver previsión completa
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Expiring Lots */}
          <div className="rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-display text-lg font-semibold">Caducidades ≤7d</h3>
              <Badge variant={expiringLots.length > 0 ? "outline" : "secondary"} className="bg-warning/10 text-warning border-warning/20">
                {expiringLots.length}
              </Badge>
            </div>
            <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
              {expiringLots.length > 0 ? (
                expiringLots.map((lot, index) => {
                  const daysUntil = differenceInDays(new Date(lot.expiry_date!), new Date());
                  return (
                    <div 
                      key={lot.id}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-lg animate-fade-in",
                        daysUntil <= 2 ? "bg-destructive/5" : "bg-warning/5"
                      )}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div>
                        <p className="text-sm font-medium">{lot.product?.name || "Producto"}</p>
                        <p className="text-xs text-muted-foreground">
                          {lot.quantity} • {lot.location}
                        </p>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs",
                          daysUntil <= 2 
                            ? "bg-destructive/10 text-destructive border-destructive/20" 
                            : "bg-warning/10 text-warning border-warning/20"
                        )}
                      >
                        {daysUntil}d
                      </Badge>
                    </div>
                  );
                })
              ) : (
                <p className="text-center text-muted-foreground py-4">
                  Sin productos próximos a caducar
                </p>
              )}
            </div>
            <div className="p-3 border-t border-border">
              <Link to="/inventory">
                <Button variant="ghost" size="sm" className="w-full text-xs">
                  Ver inventario completo
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Middle Column - Tasks */}
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-display text-lg font-semibold">Tareas del Día</h3>
            <Link to="/tasks">
              <Button variant="ghost" size="sm" className="text-xs">
                Ver todas
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
            {pendingTasks.length > 0 ? (
              pendingTasks.slice(0, 8).map((task, index) => (
                <div 
                  key={task.id}
                  className={cn(
                    "p-3 rounded-lg border transition-all animate-fade-in",
                    task.status === "in_progress" 
                      ? "border-info/30 bg-info/5" 
                      : task.priority === "high"
                      ? "border-destructive/20 bg-card"
                      : "border-border bg-card"
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {task.priority === "high" && (
                          <Flame className="h-3 w-3 text-destructive flex-shrink-0" />
                        )}
                        <p className="text-sm font-medium truncate">{task.title}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px]">
                          {task.shift === "morning" ? "Mañana" : task.shift === "evening" ? "Tarde" : "Noche"}
                        </Badge>
                      </div>
                    </div>
                    <Badge 
                      variant="outline"
                      className={cn(
                        "text-[10px] flex-shrink-0",
                        task.status === "in_progress" 
                          ? "bg-info/10 text-info border-info/20" 
                          : "bg-muted"
                      )}
                    >
                      {task.status === "in_progress" ? "En curso" : "Pendiente"}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-5 w-5 mr-2 text-success" />
                Todas las tareas completadas
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Events */}
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-display text-lg font-semibold">Próximos Eventos</h3>
            <Link to="/events">
              <Button variant="ghost" size="sm" className="text-xs">
                Ver calendario
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
            {upcomingEvents.length > 0 ? (
              upcomingEvents.slice(0, 6).map((event, index) => (
                <div 
                  key={event.id}
                  className="p-3 rounded-lg border border-border bg-card animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{event.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.event_date), "EEE d MMM", { locale: es })}
                      </p>
                    </div>
                    <div className="text-right">
                      {event.venue && (
                        <Badge variant="secondary" className="text-[10px]">
                          {event.venue.name}
                        </Badge>
                      )}
                      <p className="text-xs text-muted-foreground mt-1 flex items-center justify-end gap-1">
                        <Users className="h-3 w-3" />
                        {event.pax}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Sin eventos próximos
              </p>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Dashboard;
