import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  Activity,
  Bot,
  BellRing,
  CalendarClock,
  Gauge,
  Loader2,
  RefreshCw,
  Siren,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRequireHotel } from "@/hooks/useCurrentHotel";
import {
  useAddOpsIncidentNote,
  useGenerateOpsWeeklyKpi,
  useOpsAutomationRuns,
  useOpsAutopilotHealth,
  useCreateOpsIncident,
  useCreateServiceHeartbeat,
  useDispatchOpsAlert,
  useOpsCenterMonitoring,
  useOpsEscalations,
  useOpsIncidentEvents,
  useOpsIncidents,
  useOpsRunbooks,
  useOpsSliPanel,
  useOpsSloTargets,
  useOpsWeeklySnapshots,
  useRunOpsAutopilot,
  useUpdateOpsIncidentStatus,
} from "@/hooks/useOpsCenter";
import { useTicketBridgeHealth } from "@/hooks/useTickets";
import { cn } from "@/lib/utils";
import { serviceKeyLabel, type OpsServiceKey, type OpsServiceStatus } from "@/lib/opsWatchdog";

const HEARTBEAT_SERVICE_OPTIONS: OpsServiceKey[] = [
  "web_app",
  "sync_pipeline",
  "jobs_worker",
  "alert_dispatcher",
  "backup_monitor",
];

const INCIDENT_SEVERITY_OPTIONS = ["critical", "high", "medium", "low"] as const;
const INCIDENT_SOURCE_OPTIONS = ["manual", "system", "sync", "jobs", "backup"] as const;

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Sin registro";
  return format(parseISO(value), "d MMM yyyy, HH:mm", { locale: es });
}

function severityTone(severity: "critical" | "high" | "medium" | "low") {
  if (severity === "critical") return "bg-destructive/15 text-destructive border-destructive/30";
  if (severity === "high") return "bg-warning/15 text-warning border-warning/30";
  if (severity === "medium") return "bg-info/15 text-info border-info/30";
  return "bg-muted text-muted-foreground border-border";
}

function statusTone(status: "open" | "investigating" | "mitigated" | "resolved") {
  if (status === "open") return "bg-destructive/15 text-destructive border-destructive/30";
  if (status === "investigating") return "bg-warning/15 text-warning border-warning/30";
  if (status === "mitigated") return "bg-info/15 text-info border-info/30";
  return "bg-success/15 text-success border-success/30";
}

function watchdogTone(severity: "critical" | "warning") {
  return severity === "critical"
    ? "border-destructive/30 bg-destructive/10 text-destructive"
    : "border-warning/30 bg-warning/10 text-warning";
}

function bridgeTone(status: "up" | "degraded" | "down") {
  if (status === "up") return "bg-success/10 text-success border-success/30";
  if (status === "degraded") return "bg-warning/10 text-warning border-warning/30";
  return "bg-destructive/10 text-destructive border-destructive/30";
}

function mtaTone(actual: number, target: number) {
  if (actual <= target) return "text-success";
  if (actual <= target * 1.25) return "text-warning";
  return "text-destructive";
}

function escalationTone(state: "none" | "escalated" | "reminder" | "acknowledged") {
  if (state === "escalated") return "bg-destructive/10 text-destructive border-destructive/30";
  if (state === "reminder") return "bg-warning/10 text-warning border-warning/30";
  if (state === "acknowledged") return "bg-success/10 text-success border-success/30";
  return "bg-muted text-muted-foreground border-border";
}

function formatMinutes(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `${Math.round(value)} min`;
}

function formatPct(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `${value.toFixed(1)}%`;
}

const Operations = () => {
  const { hasHotel, error: hotelError } = useRequireHotel();
  const monitoringQuery = useOpsCenterMonitoring();
  const incidentsQuery = useOpsIncidents({ includeResolved: true });
  const runbooksQuery = useOpsRunbooks();
  const escalationsQuery = useOpsEscalations({ onlyActive: true });
  const automationRunsQuery = useOpsAutomationRuns(30);
  const sliPanelQuery = useOpsSliPanel();
  const sloTargetsQuery = useOpsSloTargets();
  const weeklySnapshotsQuery = useOpsWeeklySnapshots(8);
  const autopilotHealthQuery = useOpsAutopilotHealth();
  const ticketBridgeHealthQuery = useTicketBridgeHealth();

  const createIncident = useCreateOpsIncident();
  const updateIncident = useUpdateOpsIncidentStatus();
  const addIncidentNote = useAddOpsIncidentNote();
  const createHeartbeat = useCreateServiceHeartbeat();
  const dispatchAlert = useDispatchOpsAlert();
  const runAutopilot = useRunOpsAutopilot();
  const generateWeeklyKpi = useGenerateOpsWeeklyKpi();

  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createSummary, setCreateSummary] = useState("");
  const [createSeverity, setCreateSeverity] = useState<(typeof INCIDENT_SEVERITY_OPTIONS)[number]>("medium");
  const [createSource, setCreateSource] = useState<(typeof INCIDENT_SOURCE_OPTIONS)[number]>("manual");
  const [createRunbook, setCreateRunbook] = useState("none");

  const [heartbeatService, setHeartbeatService] = useState<OpsServiceKey>("web_app");
  const [heartbeatStatus, setHeartbeatStatus] = useState<OpsServiceStatus>("ok");
  const [heartbeatQueue, setHeartbeatQueue] = useState("0");
  const [heartbeatDetail, setHeartbeatDetail] = useState("");

  const incidents = incidentsQuery.data;
  const openIncidents = useMemo(
    () => (incidents ?? []).filter((incident) => incident.status !== "resolved"),
    [incidents],
  );
  const historyIncidents = useMemo(
    () => (incidents ?? []).filter((incident) => incident.status === "resolved").slice(0, 20),
    [incidents],
  );

  const selectedIncident = openIncidents[0] ?? null;
  const incidentEventsQuery = useOpsIncidentEvents(selectedIncident?.id ?? null);
  const runbooks = runbooksQuery.data ?? [];
  const escalations = escalationsQuery.data ?? [];
  const automationRuns = automationRunsQuery.data ?? [];
  const sliServices = sliPanelQuery.data?.services ?? [];
  const incidentSli = sliPanelQuery.data?.incidents ?? null;
  const sloTargets = sloTargetsQuery.data;
  const weeklySnapshots = weeklySnapshotsQuery.data ?? [];

  const handleCreateIncident = async () => {
    if (!createTitle.trim()) return;

    await createIncident.mutateAsync({
      title: createTitle.trim(),
      summary: createSummary.trim() || undefined,
      severity: createSeverity,
      source: createSource,
      runbookSlug: createRunbook === "none" ? undefined : createRunbook,
    });

    setCreateOpen(false);
    setCreateTitle("");
    setCreateSummary("");
    setCreateSeverity("medium");
    setCreateSource("manual");
    setCreateRunbook("none");
  };

  const handleCreateWatchdogIncident = async (input: { title: string; detail: string; serviceKey: OpsServiceKey; severity: "critical" | "warning" }) => {
    await createIncident.mutateAsync({
      title: input.title,
      summary: input.detail,
      severity: input.severity === "critical" ? "critical" : "high",
      source: input.serviceKey === "backup_monitor" ? "backup" : input.serviceKey === "sync_pipeline" ? "sync" : "jobs",
      runbookSlug:
        input.serviceKey === "backup_monitor"
          ? "backup-restore"
          : input.serviceKey === "sync_pipeline"
            ? "sync-delayed"
            : "jobs-queue-backlog",
      asWatchdog: true,
    });
  };

  const handleHeartbeat = async () => {
    await createHeartbeat.mutateAsync({
      serviceKey: heartbeatService,
      status: heartbeatStatus,
      queueDepth: Number.isFinite(Number(heartbeatQueue)) ? Math.max(0, Number(heartbeatQueue)) : 0,
      detail: heartbeatDetail.trim() || null,
      metadata: { source: "operations_page", manual: true },
    });
    setHeartbeatDetail("");
  };

  const handleRunAutopilot = async () => {
    await runAutopilot.mutateAsync({ maxIncidents: 150 });
  };

  const handleGenerateKpi = async () => {
    await generateWeeklyKpi.mutateAsync();
  };

  if (!hasHotel) {
    return (
      <MainLayout title="Operacion 24/7" subtitle="Monitoreo remoto y gestion de incidentes">
        <div className="flex h-[50vh] items-center justify-center">
          <div className="text-center">
            <h3 className="font-display text-xl font-semibold mb-2">Sin hotel seleccionado</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {hotelError || "Debes crear o seleccionar un hotel para operar el centro 24/7"}
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  const summary = monitoringQuery.data?.summary;
  const watchdogAlerts = summary?.alerts ?? [];

  return (
    <MainLayout title="Operacion 24/7" subtitle="Monitoreo, watchdog, incidentes y runbooks">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => monitoringQuery.refetch()} disabled={monitoringQuery.isFetching}>
              <RefreshCw className={cn("mr-2 h-4 w-4", monitoringQuery.isFetching && "animate-spin")} />
              Refrescar
            </Button>
            <Button size="sm" variant="outline" onClick={handleRunAutopilot} disabled={runAutopilot.isPending}>
              {runAutopilot.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
              Ejecutar autopilot
            </Button>
            <Button size="sm" variant="outline" onClick={handleGenerateKpi} disabled={generateWeeklyKpi.isPending}>
              {generateWeeklyKpi.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}
              Generar KPI semanal
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
              <Siren className="mr-2 h-4 w-4" />
              Nuevo incidente
            </Button>
            <Button size="sm" onClick={() => dispatchAlert.mutate()} disabled={dispatchAlert.isPending}>
              {dispatchAlert.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellRing className="mr-2 h-4 w-4" />}
              Enviar alerta operativa
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/20 p-2">
            <Select value={heartbeatService} onValueChange={(value) => setHeartbeatService(value as OpsServiceKey)}>
              <SelectTrigger className="w-44 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HEARTBEAT_SERVICE_OPTIONS.map((serviceKey) => (
                  <SelectItem key={serviceKey} value={serviceKey}>
                    {serviceKeyLabel(serviceKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={heartbeatStatus} onValueChange={(value) => setHeartbeatStatus(value as OpsServiceStatus)}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ok">OK</SelectItem>
                <SelectItem value="degraded">Degradado</SelectItem>
                <SelectItem value="down">Down</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={heartbeatQueue}
              onChange={(event) => setHeartbeatQueue(event.target.value)}
              className="h-9 w-24"
              placeholder="cola"
            />
            <Input
              value={heartbeatDetail}
              onChange={(event) => setHeartbeatDetail(event.target.value)}
              className="h-9 w-48"
              placeholder="detalle"
            />
            <Button size="sm" onClick={handleHeartbeat} disabled={createHeartbeat.isPending}>
              {createHeartbeat.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
              Registrar heartbeat
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Uptime 24h</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-display text-2xl font-semibold">{summary ? `${summary.uptime24hPct}%` : "--"}</p>
              {sloTargets && (
                <p className="text-xs text-muted-foreground">objetivo {sloTargets.uptime_target_24h.toFixed(2)}%</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Incidentes abiertos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-display text-2xl font-semibold">{openIncidents.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Servicios degradados/down</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-display text-2xl font-semibold">{summary ? `${summary.degradedServices}/${summary.downServices}` : "--"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Backlog max cola</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-display text-2xl font-semibold">{summary?.maxQueueDepth ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Autopilot bridge</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <Badge
                variant="outline"
                className={bridgeTone(autopilotHealthQuery.data?.bridge_status ?? "degraded")}
              >
                {(autopilotHealthQuery.data?.bridge_status ?? "degraded").toUpperCase()}
              </Badge>
              <p className="text-xs text-muted-foreground">
                ok/fail/skip 30m: {(autopilotHealthQuery.data?.success_count_30m ?? 0)}/
                {(autopilotHealthQuery.data?.failed_count_30m ?? 0)}/
                {(autopilotHealthQuery.data?.skipped_count_30m ?? 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Bridge tickets OpenClaw</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <Badge
                variant="outline"
                className={bridgeTone(ticketBridgeHealthQuery.data?.bridge_status ?? "degraded")}
              >
                {(ticketBridgeHealthQuery.data?.bridge_status ?? "degraded").toUpperCase()}
              </Badge>
              <p className="text-xs text-muted-foreground">
                pending/failed: {(ticketBridgeHealthQuery.data?.pending_due ?? 0)}/{(ticketBridgeHealthQuery.data?.failed_count ?? 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Watchdog jobs/colas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {monitoringQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando watchdog...
              </div>
            ) : watchdogAlerts.length === 0 ? (
              <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">
                Sin alertas watchdog activas en este momento.
              </div>
            ) : (
              watchdogAlerts.slice(0, 8).map((alert) => (
                <div key={alert.id} className={cn("rounded-lg border p-3", watchdogTone(alert.severity))}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{alert.title}</p>
                      <p className="text-xs opacity-85">{alert.detail}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCreateWatchdogIncident({
                        title: alert.title,
                        detail: alert.detail,
                        serviceKey: alert.serviceKey,
                        severity: alert.severity,
                      })}
                      disabled={createIncident.isPending}
                    >
                      Abrir incidente
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">SLO / SLI operativo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">MTTA 30d</p>
                  <p
                    className={cn(
                      "font-display text-xl font-semibold",
                      mtaTone(incidentSli?.mtta_minutes_30d ?? 0, sloTargets?.mtta_target_minutes ?? 10),
                    )}
                  >
                    {formatMinutes(incidentSli?.mtta_minutes_30d)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    objetivo {formatMinutes(sloTargets?.mtta_target_minutes)}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">MTTR 30d</p>
                  <p
                    className={cn(
                      "font-display text-xl font-semibold",
                      mtaTone(incidentSli?.mttr_minutes_30d ?? 0, sloTargets?.mttr_target_minutes ?? 60),
                    )}
                  >
                    {formatMinutes(incidentSli?.mttr_minutes_30d)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    objetivo {formatMinutes(sloTargets?.mttr_target_minutes)}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Backlog abierto</p>
                  <p
                    className={cn(
                      "font-display text-xl font-semibold",
                      mtaTone(
                        incidentSli?.open_backlog_by_age.total_open ?? 0,
                        sloTargets?.max_open_incidents_target ?? 5,
                      ),
                    )}
                  >
                    {incidentSli?.open_backlog_by_age.total_open ?? 0}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    objetivo max {sloTargets?.max_open_incidents_target ?? 5}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Incidentes 30d por severidad</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(incidentSli?.incidents_by_severity_30d ?? {}).length === 0 ? (
                      <Badge variant="outline">Sin datos</Badge>
                    ) : (
                      Object.entries(incidentSli?.incidents_by_severity_30d ?? {}).map(([severity, total]) => (
                        <Badge key={severity} variant="outline" className={severityTone(severity as "critical" | "high" | "medium" | "low")}>
                          {severity}: {total}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Backlog por edad</p>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded border border-border p-2">{"<30m: "}{incidentSli?.open_backlog_by_age.lt_30m ?? 0}</div>
                  <div className="rounded border border-border p-2">{"30m-2h: "}{incidentSli?.open_backlog_by_age.btw_30m_2h ?? 0}</div>
                  <div className="rounded border border-border p-2">{"2h-8h: "}{incidentSli?.open_backlog_by_age.btw_2h_8h ?? 0}</div>
                  <div className="rounded border border-border p-2">{">=8h: "}{incidentSli?.open_backlog_by_age.gte_8h ?? 0}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Uptime por servicio (24h/7d)</CardTitle>
            </CardHeader>
            <CardContent>
              {sliPanelQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando SLI por servicio...
                </div>
              ) : sliServices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay muestras de uptime disponibles.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Servicio</TableHead>
                      <TableHead>24h</TableHead>
                      <TableHead>7d</TableHead>
                      <TableHead>Objetivo</TableHead>
                      <TableHead>Cola max 24h</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sliServices.map((service) => {
                      const serviceTarget = Number(
                        sloTargets?.service_targets?.[service.service_key] ??
                          sloTargets?.uptime_target_7d ??
                          99.9,
                      );
                      return (
                        <TableRow key={service.service_key}>
                          <TableCell>{serviceKeyLabel(service.service_key)}</TableCell>
                          <TableCell className={cn(mtaTone(service.uptime_24h_pct, sloTargets?.uptime_target_24h ?? 99.5))}>
                            {formatPct(service.uptime_24h_pct)}
                          </TableCell>
                          <TableCell className={cn(mtaTone(service.uptime_7d_pct, serviceTarget))}>
                            {formatPct(service.uptime_7d_pct)}
                          </TableCell>
                          <TableCell>{formatPct(serviceTarget)}</TableCell>
                          <TableCell>{service.max_queue_24h ?? 0}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Escalado automatico activo</CardTitle>
            </CardHeader>
            <CardContent>
              {escalationsQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando escalados...
                </div>
              ) : escalations.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin escalados activos en este momento.</p>
              ) : (
                <div className="space-y-2">
                  {escalations.slice(0, 10).map((escalation) => (
                    <div key={escalation.id} className="rounded-lg border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={severityTone(escalation.severity)}>
                            {escalation.severity}
                          </Badge>
                          <Badge variant="outline" className={escalationTone("escalated")}>
                            activo
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          reminder #{escalation.reminder_count} · prox. {formatDateTime(escalation.next_reminder_at)}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Incidente: {escalation.incident_id}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Auto-remediation trace (reciente)</CardTitle>
            </CardHeader>
            <CardContent>
              {automationRunsQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando ejecuciones...
                </div>
              ) : automationRuns.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin ejecuciones de auto-remediation aun.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Accion</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Duracion</TableHead>
                      <TableHead>Retry</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {automationRuns.slice(0, 12).map((run) => (
                      <TableRow key={run.id}>
                        <TableCell className="text-xs">{run.action_key}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              run.result_status === "success" && "bg-success/10 text-success border-success/30",
                              run.result_status === "failed" && "bg-destructive/10 text-destructive border-destructive/30",
                              run.result_status === "skipped" && "bg-warning/10 text-warning border-warning/30",
                            )}
                          >
                            {run.result_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{run.duration_ms ?? 0} ms</TableCell>
                        <TableCell className="text-xs">{run.retry_count}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDateTime(run.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">KPI semanal operativo (ultimas 8 semanas)</CardTitle>
          </CardHeader>
          <CardContent>
            {weeklySnapshotsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando snapshots semanales...
              </div>
            ) : weeklySnapshots.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay snapshots. Ejecuta \"Generar KPI semanal\" para crear la primera serie.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Semana</TableHead>
                    <TableHead>Incidentes</TableHead>
                    <TableHead>% auto-resueltos</TableHead>
                    <TableHead>MTTA</TableHead>
                    <TableHead>MTTR</TableHead>
                    <TableHead>Top causas raiz</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weeklySnapshots.map((snapshot) => (
                    <TableRow key={snapshot.id}>
                      <TableCell className="text-xs">
                        {snapshot.week_start} - {snapshot.week_end}
                      </TableCell>
                      <TableCell>{snapshot.total_incidents}</TableCell>
                      <TableCell>{formatPct(snapshot.auto_resolved_pct)}</TableCell>
                      <TableCell>{formatMinutes(snapshot.mtta_minutes)}</TableCell>
                      <TableCell>{formatMinutes(snapshot.mttr_minutes)}</TableCell>
                      <TableCell className="text-xs">
                        {(snapshot.root_causes ?? [])
                          .slice(0, 3)
                          .map((root) => `${root.cause} (${root.count})`)
                          .join(", ") || "Sin datos"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Incidentes activos</CardTitle>
            </CardHeader>
            <CardContent>
              {incidentsQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando incidentes...
                </div>
              ) : openIncidents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin incidentes activos.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Incidente</TableHead>
                      <TableHead>Severidad</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Escalado</TableHead>
                      <TableHead>Auto-remediation</TableHead>
                      <TableHead>Accion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openIncidents.map((incident) => (
                      <TableRow key={incident.id}>
                        <TableCell>
                          <p className="font-medium text-sm">{incident.title}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(incident.opened_at)}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={severityTone(incident.severity)}>
                            {incident.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusTone(incident.status)}>
                            {incident.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={escalationTone(incident.escalation_state)}>
                            {incident.escalation_state} L{incident.escalation_level}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              incident.auto_remediation_state === "success" && "bg-success/10 text-success border-success/30",
                              incident.auto_remediation_state === "failed" && "bg-destructive/10 text-destructive border-destructive/30",
                              incident.auto_remediation_state === "running" && "bg-info/10 text-info border-info/30",
                              incident.auto_remediation_state === "cooldown" && "bg-warning/10 text-warning border-warning/30",
                            )}
                          >
                            {incident.auto_remediation_state}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {incident.status !== "investigating" && incident.status !== "resolved" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() => updateIncident.mutate({ incidentId: incident.id, status: "investigating" })}
                              >
                                Investigar
                              </Button>
                            )}
                            {incident.status !== "mitigated" && incident.status !== "resolved" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() => updateIncident.mutate({ incidentId: incident.id, status: "mitigated" })}
                              >
                                Mitigar
                              </Button>
                            )}
                            {incident.status !== "resolved" && (
                              <Button
                                size="sm"
                                className="h-8"
                                onClick={() => updateIncident.mutate({ incidentId: incident.id, status: "resolved" })}
                              >
                                Resolver
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline del incidente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!selectedIncident ? (
                <p className="text-sm text-muted-foreground">Selecciona o crea un incidente para ver historial.</p>
              ) : (
                <>
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-sm font-medium">{selectedIncident.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedIncident.summary || "Sin resumen"}
                    </p>
                    {selectedIncident.runbook_slug && (
                      <Badge variant="outline" className="mt-2">Runbook: {selectedIncident.runbook_slug}</Badge>
                    )}
                  </div>

                  <div className="space-y-2 max-h-64 overflow-auto pr-1">
                    {(incidentEventsQuery.data ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin eventos registrados.</p>
                    ) : (
                      (incidentEventsQuery.data ?? []).map((event) => (
                        <div key={event.id} className="rounded-lg border border-border p-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1">
                              <Badge variant="outline">{event.event_type}</Badge>
                              <Badge variant="outline" className="text-[10px]">{event.actor_type}</Badge>
                            </div>
                            <span className="text-[11px] text-muted-foreground">{formatDateTime(event.created_at)}</span>
                          </div>
                          {event.note && <p className="mt-1 text-xs">{event.note}</p>}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="incident-note">Agregar nota</Label>
                    <Textarea
                      id="incident-note"
                      placeholder="Anota accion ejecutada, evidencia y resultado..."
                      rows={3}
                      onBlur={(event) => {
                        const note = event.target.value.trim();
                        if (!note || !selectedIncident) return;
                        addIncidentNote.mutate({ incidentId: selectedIncident.id, note });
                        event.target.value = "";
                      }}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      La nota se guarda al salir del campo.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial de incidentes resueltos</CardTitle>
          </CardHeader>
          <CardContent>
            {historyIncidents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay incidentes resueltos aun.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Incidente</TableHead>
                    <TableHead>Fuente</TableHead>
                    <TableHead>Abierto</TableHead>
                    <TableHead>Resuelto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyIncidents.map((incident) => (
                    <TableRow key={incident.id}>
                      <TableCell>
                        <p className="text-sm font-medium">{incident.title}</p>
                        <Badge variant="outline" className={severityTone(incident.severity)}>{incident.severity}</Badge>
                      </TableCell>
                      <TableCell>{incident.source}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(incident.opened_at)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(incident.resolved_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Runbooks operativos</CardTitle>
          </CardHeader>
          <CardContent>
            {runbooksQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando runbooks...
              </div>
            ) : runbooks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay runbooks activos.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {runbooks.map((runbook) => (
                  <div key={runbook.id} className="rounded-xl border border-border bg-card p-3 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-medium text-sm">{runbook.title}</h4>
                      <Badge variant="outline">{runbook.category}</Badge>
                    </div>
                    {runbook.trigger_pattern && (
                      <p className="mt-1 text-xs text-muted-foreground">Trigger: {runbook.trigger_pattern}</p>
                    )}
                    <ol className="mt-2 list-decimal pl-4 text-xs space-y-1">
                      {runbook.steps.map((step, index) => (
                        <li key={`${runbook.id}-${index}`}>{step}</li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo incidente operativo</DialogTitle>
            <DialogDescription>
              Registra incidente con severidad, fuente y runbook para seguimiento remoto.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="incident-title">Titulo</Label>
              <Input id="incident-title" value={createTitle} onChange={(event) => setCreateTitle(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="incident-summary">Resumen</Label>
              <Textarea
                id="incident-summary"
                rows={3}
                value={createSummary}
                onChange={(event) => setCreateSummary(event.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Severidad</Label>
                <Select value={createSeverity} onValueChange={(value) => setCreateSeverity(value as (typeof INCIDENT_SEVERITY_OPTIONS)[number])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCIDENT_SEVERITY_OPTIONS.map((severity) => (
                      <SelectItem key={severity} value={severity}>{severity}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fuente</Label>
                <Select value={createSource} onValueChange={(value) => setCreateSource(value as (typeof INCIDENT_SOURCE_OPTIONS)[number])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCIDENT_SOURCE_OPTIONS.map((source) => (
                      <SelectItem key={source} value={source}>{source}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Runbook</Label>
                <Select value={createRunbook} onValueChange={setCreateRunbook}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin runbook</SelectItem>
                    {runbooks.map((runbook) => (
                      <SelectItem key={runbook.id} value={runbook.slug}>{runbook.slug}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateIncident} disabled={!createTitle.trim() || createIncident.isPending}>
              {createIncident.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear incidente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Operations;
