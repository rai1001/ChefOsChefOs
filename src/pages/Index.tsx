import { useMemo, useState } from "react";
import { differenceInDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  ClipboardList,
  Coffee,
  Loader2,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useDashboardStats,
  useExpiringLots,
  usePendingTasks,
  useUpcomingEvents,
} from "@/hooks/useDashboard";
import { useUpcomingForecasts } from "@/hooks/useForecasts";
import { useIncompleteDeliveries, usePendingDeliveries } from "@/hooks/usePurchases";
import { useExecutiveDashboardMetrics, type AlertSeverity } from "@/hooks/useExecutiveDashboard";
import { ForecastXLSXImport } from "@/components/import/ForecastXLSXImport";
import { useAuth } from "@/hooks/useAuth";

function formatCurrency(value: number) {
  return `EUR ${value.toLocaleString("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function alertTone(severity: AlertSeverity) {
  if (severity === "critical") return "bg-destructive/10 text-destructive border-destructive/20";
  if (severity === "medium") return "bg-warning/10 text-warning border-warning/20";
  return "bg-muted text-muted-foreground";
}

const Dashboard = () => {
  const [viewMode, setViewMode] = useState<"summary" | "detail">("summary");
  const { hasManagementAccess, hasRole } = useAuth();
  const canCreateTask = hasManagementAccess() || hasRole("super_admin");
  const { isLoading: statsLoading } = useDashboardStats();
  const { data: upcomingEvents = [] } = useUpcomingEvents(7);
  const { data: expiringLots = [] } = useExpiringLots(7);
  const { data: pendingTasks = [] } = usePendingTasks();
  const { data: forecasts = [] } = useUpcomingForecasts(7);
  const { data: pendingDeliveries } = usePendingDeliveries();
  const { data: incompleteDeliveries = [] } = useIncompleteDeliveries();
  const { data: executiveMetrics } = useExecutiveDashboardMetrics();

  const weeklyBreakfasts = forecasts.reduce((sum, row) => sum + (row.breakfast_pax || 0), 0);
  const totalUpcomingPax = upcomingEvents.reduce((sum, row) => sum + (row.pax || 0), 0);
  const lateDeliveries = pendingDeliveries?.late?.length || 0;
  const criticalExpiry = expiringLots.filter((row) => differenceInDays(new Date(row.expiry_date!), new Date()) <= 2).length;
  const totalAlerts = criticalExpiry + lateDeliveries + incompleteDeliveries.length;
  const tasksInProgress = pendingTasks.filter((task) => task.status === "in_progress").length;
  const tasksPending = pendingTasks.filter((task) => task.status === "pending").length;

  const deviationTone = useMemo(() => {
    const deviationPct = executiveMetrics?.forecastDeviationPct7d;
    if (deviationPct === null || deviationPct === undefined) return "bg-muted text-muted-foreground border-border";
    if (Math.abs(deviationPct) >= 25) return "bg-destructive/10 text-destructive border-destructive/20";
    if (Math.abs(deviationPct) >= 10) return "bg-warning/10 text-warning border-warning/20";
    return "bg-success/10 text-success border-success/20";
  }, [executiveMetrics?.forecastDeviationPct7d]);

  if (statsLoading) {
    return (
      <MainLayout title="Dashboard" subtitle="Centro de decisiones operativo">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Dashboard" subtitle="Centro de decisiones operativo">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center rounded-lg border border-border p-1">
            <Button size="sm" variant={viewMode === "summary" ? "default" : "ghost"} onClick={() => setViewMode("summary")}>
              Resumen
            </Button>
            <Button size="sm" variant={viewMode === "detail" ? "default" : "ghost"} onClick={() => setViewMode("detail")}>
              Detalle
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/purchases?quick=new-purchase">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Crear compra
              </Link>
            </Button>
            {canCreateTask && (
              <>
                <Button asChild size="sm" variant="outline">
                  <Link to="/tasks?quick=new-task&service=breakfast">
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Tarea desayuno
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/tasks?quick=new-task&service=event">
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Tarea evento
                  </Link>
                </Button>
              </>
            )}
            <Button asChild size="sm">
              <Link to="/forecast">
                <TrendingUp className="h-4 w-4 mr-2" />
                Ajustar prevision
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link to="/purchases" className={cn("rounded-xl border p-4 shadow-sm transition-all hover:shadow-md", totalAlerts > 0 ? "border-destructive/30 bg-destructive/5" : "border-border bg-card")}>
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                <AlertTriangle className={cn("h-5 w-5", totalAlerts > 0 ? "text-destructive animate-pulse" : "text-destructive/50")} />
              </div>
              {totalAlerts > 0 && <Badge variant="destructive">{totalAlerts}</Badge>}
            </div>
            <p className="mt-3 font-display text-2xl font-semibold">{totalAlerts}</p>
            <p className="text-sm text-muted-foreground">Alertas activas</p>
          </Link>

          <Link to="/purchases" className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-3 font-display text-2xl font-semibold">{formatCurrency(executiveMetrics?.estimatedDailyCost ?? 0)}</p>
            <p className="text-sm text-muted-foreground">Coste diario estimado</p>
          </Link>

          <Link to="/inventory" className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-3 font-display text-2xl font-semibold">{formatCurrency(executiveMetrics?.estimatedWasteEuro30d ?? 0)}</p>
            <p className="text-sm text-muted-foreground">Merma estimada 30d</p>
            <p className="text-xs text-muted-foreground mt-1">
              {(executiveMetrics?.estimatedWastePct30d ?? 0).toFixed(1)}%
            </p>
          </Link>

          <Link to="/products" className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                <ShoppingCart className="h-5 w-5 text-destructive" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-3 font-display text-2xl font-semibold">{executiveMetrics?.stockoutsToday ?? 0} / {executiveMetrics?.projectedStockouts7d ?? 0}</p>
            <p className="text-sm text-muted-foreground">Roturas stock hoy/7d</p>
          </Link>

          <Link to="/forecast" className={cn("rounded-xl border p-4 shadow-sm transition-all hover:shadow-md", deviationTone)}>
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background/70">
                <TrendingUp className="h-5 w-5" />
              </div>
              <ArrowUpRight className="h-4 w-4" />
            </div>
            <p className="mt-3 font-display text-2xl font-semibold">
              {executiveMetrics?.forecastDeviationPct7d === null || executiveMetrics?.forecastDeviationPct7d === undefined
                ? "N/A"
                : `${executiveMetrics.forecastDeviationPct7d > 0 ? "+" : ""}${executiveMetrics.forecastDeviationPct7d.toFixed(1)}%`}
            </p>
            <p className="text-sm">Desviacion previsión vs real</p>
          </Link>

          <Link to="/tasks" className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
                <ClipboardList className="h-5 w-5 text-info" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-3 font-display text-2xl font-semibold">{pendingTasks.length}</p>
            <p className="text-sm text-muted-foreground">Tareas (7d)</p>
            <p className="text-xs text-muted-foreground mt-1">{tasksInProgress} en curso / {tasksPending} pendientes</p>
          </Link>

          <Link to="/forecast" className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Coffee className="h-5 w-5 text-primary" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-3 font-display text-2xl font-semibold">{weeklyBreakfasts}</p>
            <p className="text-sm text-muted-foreground">Desayunos (7d)</p>
          </Link>

          <Link to="/events" className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20">
                <Calendar className="h-5 w-5 text-accent-foreground" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-3 font-display text-2xl font-semibold">{upcomingEvents.length}</p>
            <p className="text-sm text-muted-foreground">Eventos (mes)</p>
            <p className="text-xs text-muted-foreground mt-1">{totalUpcomingPax} personas</p>
          </Link>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-display text-lg font-semibold">Alertas priorizadas</h3>
            <Badge variant="outline">{executiveMetrics?.alerts.length ?? 0}</Badge>
          </div>
          <div className="p-4 grid gap-3 md:grid-cols-2">
            {(executiveMetrics?.alerts.length ?? 0) > 0 ? (
              executiveMetrics?.alerts.slice(0, 4).map((alert) => (
                <div key={alert.id} className={cn("rounded-lg border p-3", alertTone(alert.severity))}>
                  <p className="text-sm font-medium">{alert.title}</p>
                  <p className="text-xs opacity-80 mt-1">{alert.detail}</p>
                  <Button asChild size="sm" variant="secondary" className="mt-2">
                    <Link to={alert.ctaTo}>{alert.ctaLabel}</Link>
                  </Button>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-sm text-success">
                Sin alertas criticas en este momento.
              </div>
            )}
          </div>
        </div>

        {viewMode === "summary" ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-display text-lg font-semibold">Tareas prioritarias</h3>
                {canCreateTask ? (
                  <div className="flex items-center gap-2 text-xs">
                    <Link to="/tasks?quick=new-task&service=breakfast" className="text-primary">Desayuno</Link>
                    <Link to="/tasks?quick=new-task&service=event" className="text-primary">Evento</Link>
                  </div>
                ) : (
                  <Link to="/tasks" className="text-xs text-primary">Ver tareas</Link>
                )}
              </div>
              <div className="p-4 space-y-2">
                {pendingTasks.slice(0, 6).map((task) => (
                  <div key={task.id} className="rounded-lg border p-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <Badge variant="outline" className="text-[10px]">{task.status === "in_progress" ? "En curso" : "Pendiente"}</Badge>
                  </div>
                ))}
                {pendingTasks.length === 0 && <p className="text-sm text-muted-foreground">No hay tareas pendientes.</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-display text-lg font-semibold">Eventos y prevision</h3>
                <ForecastXLSXImport />
              </div>
              <div className="p-4 space-y-2">
                {upcomingEvents.slice(0, 4).map((event) => (
                  <div key={event.id} className="rounded-lg border p-2">
                    <p className="text-sm font-medium">{event.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(event.event_date), "EEE d MMM", { locale: es })} - {event.pax} pax
                    </p>
                  </div>
                ))}
                {upcomingEvents.length === 0 && <p className="text-sm text-muted-foreground">Sin eventos proximos.</p>}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-display text-lg font-semibold">Prevision 7 dias</h3>
                <ForecastXLSXImport />
              </div>
              <div className="p-4 space-y-2">
                {forecasts.slice(0, 7).map((row) => (
                  <div key={row.id} className="rounded-lg border p-2 flex items-center justify-between">
                    <p className="text-sm">{format(new Date(row.forecast_date), "EEE d", { locale: es })}</p>
                    <p className="font-semibold text-primary">{row.breakfast_pax || 0}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-display text-lg font-semibold">Caducidades {"<="} 7d</h3>
                <Badge variant="outline">{expiringLots.length}</Badge>
              </div>
              <div className="p-4 space-y-2">
                {expiringLots.slice(0, 7).map((lot) => (
                  <div key={lot.id} className="rounded-lg border p-2 flex items-center justify-between">
                    <p className="text-sm truncate">{lot.product?.name || "Producto"}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {differenceInDays(new Date(lot.expiry_date!), new Date())}d
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-display text-lg font-semibold">Proximos eventos</h3>
                <Link to="/events" className="text-xs text-primary">Ver calendario</Link>
              </div>
              <div className="p-4 space-y-2">
                {upcomingEvents.slice(0, 7).map((event) => (
                  <div key={event.id} className="rounded-lg border p-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium truncate">{event.name}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(event.event_date), "d MMM", { locale: es })}</p>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {event.pax}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Dashboard;
