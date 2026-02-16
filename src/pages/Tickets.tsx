import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Send,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRequireHotel } from "@/hooks/useCurrentHotel";
import {
  useAddTicketNote,
  useAssignTicket,
  useCreateTicket,
  useDispatchTicketBridge,
  useReceivedTicketsInbox,
  useSetTicketStatus,
  useTicket,
  useTicketAssignees,
  useTicketBridgeHealth,
  useTicketEvents,
  useTicketMetrics,
  useTickets,
} from "@/hooks/useTickets";
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_SEVERITIES,
  TICKET_SOURCES,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketSeverity,
  type TicketStatus,
} from "@/lib/ticketing";
import { cn } from "@/lib/utils";

function statusTone(status: TicketStatus) {
  if (status === "received") return "bg-muted text-muted-foreground border-border";
  if (status === "triaged") return "bg-info/15 text-info border-info/30";
  if (status === "in_progress") return "bg-primary/15 text-primary border-primary/30";
  if (status === "blocked") return "bg-warning/15 text-warning border-warning/30";
  if (status === "fixed") return "bg-success/15 text-success border-success/30";
  if (status === "needs_human") return "bg-destructive/15 text-destructive border-destructive/30";
  return "bg-success/10 text-success border-success/25";
}

function severityTone(severity: TicketSeverity) {
  if (severity === "critical") return "bg-destructive/15 text-destructive border-destructive/30";
  if (severity === "high") return "bg-warning/15 text-warning border-warning/30";
  if (severity === "medium") return "bg-info/15 text-info border-info/30";
  return "bg-muted text-muted-foreground border-border";
}

function priorityTone(priority: TicketPriority) {
  if (priority === "P1") return "bg-destructive/15 text-destructive border-destructive/30";
  if (priority === "P2") return "bg-warning/15 text-warning border-warning/30";
  if (priority === "P3") return "bg-info/15 text-info border-info/30";
  return "bg-muted text-muted-foreground border-border";
}

function bridgeTone(status: "up" | "degraded" | "down") {
  if (status === "up") return "bg-success/15 text-success border-success/30";
  if (status === "degraded") return "bg-warning/15 text-warning border-warning/30";
  return "bg-destructive/15 text-destructive border-destructive/30";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Sin registro";
  return format(parseISO(value), "d MMM yyyy, HH:mm", { locale: es });
}

const Tickets = () => {
  const { hasHotel, error: hotelError } = useRequireHotel();

  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<TicketSeverity | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | "all">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [requesterFilter, setRequesterFilter] = useState("");

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createCategory, setCreateCategory] = useState<(typeof TICKET_CATEGORIES)[number]>("soporte");
  const [createSeverity, setCreateSeverity] = useState<(typeof TICKET_SEVERITIES)[number]>("medium");
  const [createPriority, setCreatePriority] = useState<(typeof TICKET_PRIORITIES)[number]>("P3");
  const [createSource, setCreateSource] = useState<(typeof TICKET_SOURCES)[number]>("web");
  const [createRequesterName, setCreateRequesterName] = useState("");
  const [createAttachmentUrls, setCreateAttachmentUrls] = useState("");
  const [createMetadataAppVersion, setCreateMetadataAppVersion] = useState("");
  const [createMetadataPlatform, setCreateMetadataPlatform] = useState("");
  const [createMetadataLocale, setCreateMetadataLocale] = useState("");

  const [statusDraft, setStatusDraft] = useState<TicketStatus>("received");
  const [assigneeDraft, setAssigneeDraft] = useState<string>("none");
  const [noteDraft, setNoteDraft] = useState("");
  const ticketsQuery = useTickets({
    status: statusFilter,
    severity: severityFilter,
    priority: priorityFilter,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    search,
    requester: requesterFilter,
  });
  const receivedInboxQuery = useReceivedTicketsInbox();

  const selectedTicketQuery = useTicket(selectedTicketId);
  const ticketEventsQuery = useTicketEvents(selectedTicketId);
  const ticketMetricsQuery = useTicketMetrics();
  const bridgeHealthQuery = useTicketBridgeHealth();
  const assigneesQuery = useTicketAssignees();

  const createTicket = useCreateTicket();
  const setTicketStatus = useSetTicketStatus();
  const assignTicket = useAssignTicket();
  const addTicketNote = useAddTicketNote();
  const dispatchBridge = useDispatchTicketBridge();

  const tickets = ticketsQuery.data ?? [];
  const selectedTicket = selectedTicketQuery.data;
  const selectedTicketEvents = ticketEventsQuery.data ?? [];

  useEffect(() => {
    const currentTickets = ticketsQuery.data ?? [];
    if (!selectedTicketId && currentTickets.length > 0) {
      setSelectedTicketId(currentTickets[0].id);
    }
  }, [selectedTicketId, ticketsQuery.data]);

  useEffect(() => {
    if (!selectedTicket) return;
    setStatusDraft(selectedTicket.status);
    setAssigneeDraft(selectedTicket.assignee_user_id ?? "none");
  }, [selectedTicket]);

  const bridgeBadge = useMemo(() => {
    const status = bridgeHealthQuery.data?.bridge_status ?? "degraded";
    return (
      <Badge variant="outline" className={bridgeTone(status)}>
        Bridge: {status.toUpperCase()}
      </Badge>
    );
  }, [bridgeHealthQuery.data?.bridge_status]);

  const handleCreateTicket = async () => {
    if (!createTitle.trim() || !createDescription.trim()) return;

    const attachments = createAttachmentUrls
      .split(",")
      .map((url) => url.trim())
      .filter(Boolean)
      .map((url, index) => ({
        name: `adjunto-${index + 1}`,
        url,
        size: null,
        contentType: null,
      }));

    await createTicket.mutateAsync({
      title: createTitle,
      description: createDescription,
      category: createCategory,
      severity: createSeverity,
      priority: createPriority,
      source: createSource,
      requesterName: createRequesterName || undefined,
      attachments,
      metadata: {
        appVersion: createMetadataAppVersion || null,
        platform: createMetadataPlatform || null,
        locale: createMetadataLocale || null,
      },
    });

    setCreateOpen(false);
    setCreateTitle("");
    setCreateDescription("");
    setCreateCategory("soporte");
    setCreateSeverity("medium");
    setCreatePriority("P3");
    setCreateSource("web");
    setCreateRequesterName("");
    setCreateAttachmentUrls("");
    setCreateMetadataAppVersion("");
    setCreateMetadataPlatform("");
    setCreateMetadataLocale("");
  };

  const handleApplyStatus = async () => {
    if (!selectedTicketId) return;
    await setTicketStatus.mutateAsync({ ticketId: selectedTicketId, status: statusDraft });
  };

  const handleAssign = async () => {
    if (!selectedTicketId) return;
    await assignTicket.mutateAsync({
      ticketId: selectedTicketId,
      assigneeUserId: assigneeDraft === "none" ? null : assigneeDraft,
    });
  };

  const handleAddNote = async () => {
    if (!selectedTicketId || !noteDraft.trim()) return;
    await addTicketNote.mutateAsync({
      ticketId: selectedTicketId,
      note: noteDraft,
    });
    setNoteDraft("");
  };

  const openCount = tickets.filter((ticket) => ticket.status !== "closed").length;

  if (!hasHotel) {
    return (
      <MainLayout title="Tickets" subtitle="Gestion de soporte e integracion OpenClaw">
        <div className="flex h-[50vh] items-center justify-center">
          <div className="text-center">
            <h3 className="font-display text-xl font-semibold mb-2">Sin hotel seleccionado</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {hotelError || "Debes crear o seleccionar un hotel para gestionar tickets"}
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Tickets" subtitle="Ticketing end-to-end con bridge OpenClaw">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => ticketsQuery.refetch()} disabled={ticketsQuery.isFetching}>
              <RefreshCw className={cn("h-4 w-4 mr-2", ticketsQuery.isFetching && "animate-spin")} />
              Refrescar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo ticket
            </Button>
            <Button size="sm" onClick={() => dispatchBridge.mutate()} disabled={dispatchBridge.isPending}>
              {dispatchBridge.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Ejecutar bridge
            </Button>
          </div>
          {bridgeBadge}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Tickets abiertos</CardTitle></CardHeader>
            <CardContent><p className="font-display text-2xl font-semibold">{openCount}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Creados hoy</CardTitle></CardHeader>
            <CardContent><p className="font-display text-2xl font-semibold">{ticketMetricsQuery.data?.tickets_created_today ?? 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">First response</CardTitle></CardHeader>
            <CardContent>
              <p className="font-display text-2xl font-semibold">
                {ticketMetricsQuery.data?.avg_first_response_minutes === null || ticketMetricsQuery.data?.avg_first_response_minutes === undefined
                  ? "N/A"
                  : `${ticketMetricsQuery.data.avg_first_response_minutes.toFixed(1)}m`}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Tiempo resolucion</CardTitle></CardHeader>
            <CardContent>
              <p className="font-display text-2xl font-semibold">
                {ticketMetricsQuery.data?.avg_resolution_minutes === null || ticketMetricsQuery.data?.avg_resolution_minutes === undefined
                  ? "N/A"
                  : `${ticketMetricsQuery.data.avg_resolution_minutes.toFixed(1)}m`}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Bridge pending/failed</CardTitle></CardHeader>
            <CardContent>
              <p className="font-display text-2xl font-semibold">
                {(bridgeHealthQuery.data?.pending_due ?? 0)}/{(bridgeHealthQuery.data?.failed_count ?? 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as TicketStatus | "all")}>
                <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Estado: todos</SelectItem>
                  {TICKET_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={severityFilter} onValueChange={(value) => setSeverityFilter(value as TicketSeverity | "all")}>
                <SelectTrigger><SelectValue placeholder="Severidad" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Severidad: todas</SelectItem>
                  {TICKET_SEVERITIES.map((severity) => (
                    <SelectItem key={severity} value={severity}>{severity}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as TicketPriority | "all")}>
                <SelectTrigger><SelectValue placeholder="Prioridad" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Prioridad: todas</SelectItem>
                  {TICKET_PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
              <Input placeholder="Requester" value={requesterFilter} onChange={(event) => setRequesterFilter(event.target.value)} />
              <Input placeholder="Buscar ticket" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bandeja inicial (received / sin triage)</CardTitle>
          </CardHeader>
          <CardContent>
            {(receivedInboxQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay tickets en estado received.</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {(receivedInboxQuery.data ?? []).slice(0, 6).map((ticket) => (
                  <button
                    type="button"
                    key={ticket.id}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors hover:bg-muted/30",
                      selectedTicketId === ticket.id && "border-primary bg-primary/5",
                    )}
                    onClick={() => setSelectedTicketId(ticket.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate">{ticket.ticket_id}</p>
                      <Badge variant="outline" className={priorityTone(ticket.priority)}>{ticket.priority}</Badge>
                    </div>
                    <p className="text-sm mt-1 line-clamp-2">{ticket.title}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <Badge variant="outline" className={severityTone(ticket.severity)}>{ticket.severity}</Badge>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7"
                        onClick={(event) => {
                          event.stopPropagation();
                          void setTicketStatus.mutateAsync({ ticketId: ticket.id, status: "triaged" });
                        }}
                      >
                        Triage
                      </Button>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <div className="grid gap-6 xl:grid-cols-[1.2fr,1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lista de tickets</CardTitle>
            </CardHeader>
            <CardContent>
              {ticketsQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando tickets...
                </div>
              ) : tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay tickets con los filtros actuales.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Sev/Pri</TableHead>
                      <TableHead>Requester</TableHead>
                      <TableHead>Actualizado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map((ticket) => (
                      <TableRow
                        key={ticket.id}
                        className={cn("cursor-pointer", selectedTicketId === ticket.id && "bg-primary/5")}
                        onClick={() => setSelectedTicketId(ticket.id)}
                      >
                        <TableCell>
                          <p className="font-medium text-sm">{ticket.ticket_id}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{ticket.title}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusTone(ticket.status)}>{ticket.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className={severityTone(ticket.severity)}>{ticket.severity}</Badge>
                            <Badge variant="outline" className={priorityTone(ticket.priority)}>{ticket.priority}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{ticket.requester_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDateTime(ticket.updated_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalle y timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedTicket ? (
                <p className="text-sm text-muted-foreground">Selecciona un ticket para ver detalle.</p>
              ) : (
                <>
                  <div className="rounded-xl border border-border bg-muted/20 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-display text-lg font-semibold">{selectedTicket.ticket_id}</p>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className={statusTone(selectedTicket.status)}>{selectedTicket.status}</Badge>
                        <Badge variant="outline" className={severityTone(selectedTicket.severity)}>{selectedTicket.severity}</Badge>
                        <Badge variant="outline" className={priorityTone(selectedTicket.priority)}>{selectedTicket.priority}</Badge>
                      </div>
                    </div>
                    <p className="font-medium mt-2">{selectedTicket.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">{selectedTicket.description}</p>
                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                      <p>Categoria: {selectedTicket.category}</p>
                      <p>Source: {selectedTicket.source}</p>
                      <p>Requester: {selectedTicket.requester_name}</p>
                      <p>Creado: {formatDateTime(selectedTicket.created_at)}</p>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl border border-border p-3">
                    <div className="grid gap-2 md:grid-cols-[1fr,auto]">
                      <div className="space-y-2">
                        <Label>Estado</Label>
                        <Select value={statusDraft} onValueChange={(value) => setStatusDraft(value as TicketStatus)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TICKET_STATUSES.map((status) => (
                              <SelectItem key={status} value={status}>{status}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button className="h-10 mt-auto" onClick={handleApplyStatus} disabled={setTicketStatus.isPending}>
                        {setTicketStatus.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Aplicar
                      </Button>
                    </div>

                    <div className="grid gap-2 md:grid-cols-[1fr,auto]">
                      <div className="space-y-2">
                        <Label>Responsable</Label>
                        <Select value={assigneeDraft} onValueChange={setAssigneeDraft}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin asignar</SelectItem>
                            {(assigneesQuery.data ?? []).map((assignee) => (
                              <SelectItem key={assignee.user_id} value={assignee.user_id}>
                                {assignee.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button className="h-10 mt-auto" onClick={handleAssign} disabled={assignTicket.isPending}>
                        {assignTicket.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Asignar
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTicketStatus.mutate({ ticketId: selectedTicket.id, status: "closed" })}
                        disabled={selectedTicket.status === "closed"}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Cerrar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTicketStatus.mutate({ ticketId: selectedTicket.id, status: "triaged" })}
                        disabled={selectedTicket.status !== "closed"}
                      >
                        <AlertCircle className="h-4 w-4 mr-2" />
                        Reabrir
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl border border-border p-3">
                    <Label htmlFor="ticket-note">Agregar nota</Label>
                    <Textarea
                      id="ticket-note"
                      rows={3}
                      placeholder="Anota progreso, bloqueo o decision tomada..."
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                    />
                    <Button size="sm" onClick={handleAddNote} disabled={!noteDraft.trim() || addTicketNote.isPending}>
                      {addTicketNote.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Guardar nota
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
                    {ticketEventsQuery.isLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando timeline...
                      </div>
                    ) : selectedTicketEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin eventos en timeline.</p>
                    ) : (
                      selectedTicketEvents.map((event) => (
                        <div key={event.id} className="rounded-lg border border-border p-2">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="outline">{event.event_type}</Badge>
                            <span className="text-[11px] text-muted-foreground">{formatDateTime(event.created_at)}</span>
                          </div>
                          {event.note && <p className="mt-1 text-xs">{event.note}</p>}
                          <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-2">
                            <span>{event.actor_type}</span>
                            <span>{event.source}</span>
                            {event.to_status && <span>{`${event.from_status || "-"} -> ${event.to_status}`}</span>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear ticket</DialogTitle>
            <DialogDescription>
              Registro unificado para soporte, incidentes y mejoras con emision automatica a OpenClaw.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ticket-title">Titulo</Label>
              <Input id="ticket-title" value={createTitle} onChange={(event) => setCreateTitle(event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ticket-description">Descripcion</Label>
              <Textarea
                id="ticket-description"
                rows={4}
                value={createDescription}
                onChange={(event) => setCreateDescription(event.target.value)}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={createCategory} onValueChange={(value) => setCreateCategory(value as (typeof TICKET_CATEGORIES)[number])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TICKET_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Severidad</Label>
                <Select value={createSeverity} onValueChange={(value) => setCreateSeverity(value as (typeof TICKET_SEVERITIES)[number])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TICKET_SEVERITIES.map((severity) => (
                      <SelectItem key={severity} value={severity}>{severity}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select value={createPriority} onValueChange={(value) => setCreatePriority(value as (typeof TICKET_PRIORITIES)[number])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TICKET_PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Source</Label>
                <Select value={createSource} onValueChange={(value) => setCreateSource(value as (typeof TICKET_SOURCES)[number])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TICKET_SOURCES.map((source) => (
                      <SelectItem key={source} value={source}>{source}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ticket-requester">Requester name</Label>
                <Input id="ticket-requester" value={createRequesterName} onChange={(event) => setCreateRequesterName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticket-attachments">Adjuntos (URLs separadas por coma)</Label>
                <Input
                  id="ticket-attachments"
                  value={createAttachmentUrls}
                  onChange={(event) => setCreateAttachmentUrls(event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="ticket-app-version">metadata.appVersion</Label>
                <Input
                  id="ticket-app-version"
                  value={createMetadataAppVersion}
                  onChange={(event) => setCreateMetadataAppVersion(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticket-platform">metadata.platform</Label>
                <Input
                  id="ticket-platform"
                  value={createMetadataPlatform}
                  onChange={(event) => setCreateMetadataPlatform(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticket-locale">metadata.locale</Label>
                <Input
                  id="ticket-locale"
                  value={createMetadataLocale}
                  onChange={(event) => setCreateMetadataLocale(event.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateTicket} disabled={!createTitle.trim() || !createDescription.trim() || createTicket.isPending}>
              {createTicket.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Tickets;
