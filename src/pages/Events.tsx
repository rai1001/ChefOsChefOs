import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, Edit2, List, Loader2, MapPin, Plus, Trash2, Users } from "lucide-react";
import { AIMenuSuggestion } from "@/components/ai/AIMenuSuggestion";
import { EventCostVarianceCard } from "@/components/events/EventCostVarianceCard";
import { EventsCalendarGrid } from "@/components/events/EventsCalendarGrid";
import { EventsXLSXImport } from "@/components/import/EventsXLSXImport";
import { MenuOCRImport } from "@/components/import/MenuOCRImport";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useEventCostVariance } from "@/hooks/useEventCostVariance";
import {
  type EventWithRelations,
  useCreateEvent,
  useDeleteEvent,
  useEvents,
  useMenus,
  useUpdateEvent,
  useVenues,
} from "@/hooks/useEvents";

const STATUS_OPTIONS = [
  { value: "draft", label: "Borrador" },
  { value: "confirmed", label: "Confirmado" },
  { value: "cancelled", label: "Cancelado" },
] as const;

const TYPE_OPTIONS = [
  { value: "breakfast", label: "Breakfast" },
  { value: "banquet", label: "Banquete" },
  { value: "wedding", label: "Boda" },
  { value: "corporate", label: "Corporativo" },
  { value: "conference", label: "Conferencia" },
  { value: "cocktail", label: "Cocktail" },
  { value: "other", label: "Otro" },
] as const;

function showPax(event: EventWithRelations): string {
  const estimated = event.pax_estimated || event.pax || 0;
  const confirmed = event.pax_confirmed || 0;
  return `${confirmed} conf / ${estimated} est`;
}

const Events = () => {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"calendar" | "list">("list");
  const [selectedVenue, setSelectedVenue] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventWithRelations | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    event_date: format(new Date(), "yyyy-MM-dd"),
    event_time: "",
    venue_id: "",
    menu_id: "",
    pax_estimated: "",
    pax_confirmed: "",
    client_name: "",
    client_contact: "",
    notes: "",
    status: "draft",
    event_type: "other",
  });

  const now = new Date();
  const startDate = format(new Date(now.getFullYear() - 1, 0, 1), "yyyy-MM-dd");
  const endDate = format(new Date(now.getFullYear() + 1, 11, 31), "yyyy-MM-dd");

  const { data: events = [], isLoading } = useEvents({ startDate, endDate });
  const { data: venues = [] } = useVenues();
  const { data: menus = [] } = useMenus();
  const { data: costVariance = [] } = useEventCostVariance({ startDate, endDate });
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const filteredEvents = useMemo(() => {
    return events
      .filter((event) => (selectedVenue === "all" ? true : event.venue_id === selectedVenue))
      .filter((event) => (selectedStatus === "all" ? true : (event.status ?? "draft") === selectedStatus))
      .filter((event) => (selectedType === "all" ? true : event.event_type === selectedType))
      .sort((a, b) => `${a.event_date}${a.event_time ?? ""}`.localeCompare(`${b.event_date}${b.event_time ?? ""}`));
  }, [events, selectedVenue, selectedStatus, selectedType]);

  const totals = useMemo(() => {
    return filteredEvents.reduce(
      (acc, event) => {
        acc.estimated += event.pax_estimated || event.pax || 0;
        acc.confirmed += event.pax_confirmed || 0;
        return acc;
      },
      { estimated: 0, confirmed: 0 },
    );
  }, [filteredEvents]);

  const orphanEvents = filteredEvents.filter((event) => !event.event_type || !event.status).length;

  const resetForm = () => {
    setFormData({
      name: "",
      event_date: format(new Date(), "yyyy-MM-dd"),
      event_time: "",
      venue_id: "",
      menu_id: "",
      pax_estimated: "",
      pax_confirmed: "",
      client_name: "",
      client_contact: "",
      notes: "",
      status: "draft",
      event_type: "other",
    });
  };

  const openEdit = (event: EventWithRelations) => {
    setFormData({
      name: event.name,
      event_date: event.event_date,
      event_time: event.event_time ? event.event_time.slice(0, 5) : "",
      venue_id: event.venue_id || "",
      menu_id: event.menu_id || "",
      pax_estimated: String(event.pax_estimated || event.pax || 0),
      pax_confirmed: String(event.pax_confirmed || 0),
      client_name: event.client_name || "",
      client_contact: event.client_contact || "",
      notes: event.notes || "",
      status: (event.status as "draft" | "confirmed" | "cancelled") || "draft",
      event_type: event.event_type || "other",
    });
    setEditingEvent(event);
  };

  const submit = async () => {
    const estimated = Math.max(Number.parseInt(formData.pax_estimated, 10) || 0, 0);
    const confirmed = Math.max(Number.parseInt(formData.pax_confirmed, 10) || 0, 0);
    const payload = {
      name: formData.name,
      event_date: formData.event_date,
      event_time: formData.event_time || null,
      venue_id: formData.venue_id || null,
      menu_id: formData.menu_id || null,
      pax: confirmed > 0 ? confirmed : estimated,
      pax_estimated: estimated,
      pax_confirmed: confirmed,
      status: formData.status,
      event_type: formData.event_type,
      client_name: formData.client_name || null,
      client_contact: formData.client_contact || null,
      notes: formData.notes || null,
    };

    if (editingEvent) {
      await updateEvent.mutateAsync({ id: editingEvent.id, ...payload });
      setEditingEvent(null);
    } else {
      await createEvent.mutateAsync(payload);
      setIsCreateOpen(false);
    }
    resetForm();
  };

  return (
    <MainLayout title="Eventos" subtitle="Calendario, normalizacion y control operativo">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Eventos filtrados</p>
          <p className="font-display text-2xl font-semibold mt-1">{filteredEvents.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">PAX estimado</p>
          <p className="font-display text-2xl font-semibold mt-1">{totals.estimated.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">PAX confirmado</p>
          <p className="font-display text-2xl font-semibold mt-1">{totals.confirmed.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Eventos huerfanos</p>
          <p className="font-display text-2xl font-semibold mt-1">{orphanEvents}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-border p-1">
            <Button variant={viewMode === "calendar" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("calendar")}>
              <Calendar className="h-4 w-4 mr-1" />
              Calendario
            </Button>
            <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("list")}>
              <List className="h-4 w-4 mr-1" />
              Lista
            </Button>
          </div>

          <Select value={selectedVenue} onValueChange={setSelectedVenue}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Salon" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos salones</SelectItem>
              {venues.map((venue) => <SelectItem key={venue.id} value={venue.id}>{venue.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos estados</SelectItem>
              {STATUS_OPTIONS.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              {TYPE_OPTIONS.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <EventsXLSXImport />
          <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo evento
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : viewMode === "calendar" ? (
        <EventsCalendarGrid events={filteredEvents} onEdit={openEdit} />
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="p-4 border-b border-border">
            <h3 className="font-display text-lg font-semibold">Lista de eventos</h3>
          </div>
          <div className="divide-y divide-border">
            {filteredEvents.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No hay eventos para los filtros seleccionados.</div>
            ) : (
              filteredEvents.map((event) => (
                <div key={event.id} className="p-4 hover:bg-muted/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{event.name}</p>
                        <Badge variant="outline">{TYPE_OPTIONS.find((type) => type.value === event.event_type)?.label || "Otro"}</Badge>
                        <Badge variant={event.status === "confirmed" ? "default" : event.status === "cancelled" ? "destructive" : "secondary"}>
                          {STATUS_OPTIONS.find((status) => status.value === (event.status as "draft" | "confirmed" | "cancelled"))?.label || event.status || "Borrador"}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(`${event.event_date}T00:00:00`), "EEE d MMM yyyy", { locale: es })}{event.event_time ? ` - ${event.event_time.slice(0, 5)}` : ""}</span>
                        {event.venue && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{event.venue.name}</span>}
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{showPax(event)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(event)}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteId(event.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="mt-6"><EventCostVarianceCard rows={costVariance} /></div>

      <Dialog open={isCreateOpen || !!editingEvent} onOpenChange={(open) => { if (!open) { setIsCreateOpen(false); setEditingEvent(null); resetForm(); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Editar evento" : "Nuevo evento"}</DialogTitle>
            <DialogDescription>Campos normalizados de estado, tipo y pax confirmado/estimado.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-2"><Label>Nombre *</Label><Input value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4"><div className="grid gap-2"><Label>Fecha *</Label><Input type="date" value={formData.event_date} onChange={(e) => setFormData((p) => ({ ...p, event_date: e.target.value }))} /></div><div className="grid gap-2"><Label>Hora</Label><Input type="time" value={formData.event_time} onChange={(e) => setFormData((p) => ({ ...p, event_time: e.target.value }))} /></div></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>Estado</Label><Select value={formData.status} onValueChange={(value) => setFormData((p) => ({ ...p, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS_OPTIONS.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-2"><Label>Tipo</Label><Select value={formData.event_type} onValueChange={(value) => setFormData((p) => ({ ...p, event_type: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TYPE_OPTIONS.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-2"><Label>Salon</Label><Select value={formData.venue_id || "none"} onValueChange={(value) => setFormData((p) => ({ ...p, venue_id: value === "none" ? "" : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sin salon</SelectItem>{venues.map((venue) => <SelectItem key={venue.id} value={venue.id}>{venue.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-4"><div className="grid gap-2"><Label>PAX estimado</Label><Input type="number" min={0} value={formData.pax_estimated} onChange={(e) => setFormData((p) => ({ ...p, pax_estimated: e.target.value }))} /></div><div className="grid gap-2"><Label>PAX confirmado</Label><Input type="number" min={0} value={formData.pax_confirmed} onChange={(e) => setFormData((p) => ({ ...p, pax_confirmed: e.target.value }))} /></div></div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between"><Label>Menu</Label><div className="flex items-center gap-2"><MenuOCRImport onImport={(menuData) => { const menuText = menuData.sections.map((s) => `${s.name}: ${s.items.map((i) => i.name).join(", ")}`).join("\n"); setFormData((p) => ({ ...p, notes: p.notes ? `${p.notes}\n\n--- Menu OCR ---\n${menuText}` : `--- Menu OCR ---\n${menuText}` })); toast({ title: "Menu importado", description: "Se anadieron lineas OCR en notas." }); }} /><AIMenuSuggestion eventName={formData.name} pax={Number.parseInt(formData.pax_estimated, 10) || 0} eventType={formData.event_type} /></div></div>
              <Select value={formData.menu_id || "none"} onValueChange={(value) => setFormData((p) => ({ ...p, menu_id: value === "none" ? "" : value }))}><SelectTrigger><SelectValue placeholder="Sin menu" /></SelectTrigger><SelectContent><SelectItem value="none">Sin menu</SelectItem>{menus.map((menu) => <SelectItem key={menu.id} value={menu.id}>{menu.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="grid grid-cols-2 gap-4"><div className="grid gap-2"><Label>Cliente</Label><Input value={formData.client_name} onChange={(e) => setFormData((p) => ({ ...p, client_name: e.target.value }))} /></div><div className="grid gap-2"><Label>Contacto</Label><Input value={formData.client_contact} onChange={(e) => setFormData((p) => ({ ...p, client_contact: e.target.value }))} /></div></div>
            <div className="grid gap-2"><Label>Notas</Label><Textarea rows={3} value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); setEditingEvent(null); resetForm(); }}>Cancelar</Button>
            <Button onClick={submit} disabled={!formData.name || !formData.event_date || createEvent.isPending || updateEvent.isPending}>
              {(createEvent.isPending || updateEvent.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingEvent ? "Guardar cambios" : "Crear evento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar evento</AlertDialogTitle>
            <AlertDialogDescription>Esta accion elimina el evento permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (deleteId) await deleteEvent.mutateAsync(deleteId); setDeleteId(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteEvent.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default Events;
