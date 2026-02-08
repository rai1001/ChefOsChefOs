import React, { useState, useMemo, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { EventsXLSXImport } from "@/components/import/EventsXLSXImport";
import { MenuOCRImport } from "@/components/import/MenuOCRImport";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Calendar, List, Loader2, Users, MapPin, Edit2, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { useEvents, useVenues, useMenus, useCreateEvent, useUpdateEvent, useDeleteEvent, EventWithRelations } from "@/hooks/useEvents";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday, getDay } from "date-fns";
import { es } from "date-fns/locale";
import { AIMenuSuggestion } from "@/components/ai/AIMenuSuggestion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useEventCostVariance } from "@/hooks/useEventCostVariance";
import { EventCostVarianceCard } from "@/components/events/EventCostVarianceCard";

// Calendar View Component
interface EventCalendarViewProps {
  events: EventWithRelations[];
  venues: { id: string; name: string; capacity: number | null }[];
  onEditEvent: (event: EventWithRelations) => void;
  onDeleteEvent: (id: string) => void;
}

function EventCalendarView({ events, venues, onEditEvent, onDeleteEvent }: EventCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    if (events.length > 0) {
      const sortedDates = events
        .map(e => new Date(e.event_date))
        .sort((a, b) => a.getTime() - b.getTime());
      return sortedDates[0];
    }
    return new Date();
  });
  const [hasAutoNavigated, setHasAutoNavigated] = useState(false);
  
  // Auto-navigate to first event month when events load
  useEffect(() => {
    if (events.length > 0 && !hasAutoNavigated) {
      const sortedDates = events
        .map(e => new Date(e.event_date))
        .sort((a, b) => a.getTime() - b.getTime());
      setCurrentMonth(sortedDates[0]);
      setHasAutoNavigated(true);
    }
  }, [events, hasAutoNavigated]);

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const firstDayOffset = (getDay(startOfMonth(currentMonth)) + 6) % 7;

  const getEventsForDay = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return events.filter(e => e.event_date === dateStr);
  };

  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  // Generate venue colors dynamically
  const venueColors = useMemo(() => {
    const colors = [
      "bg-rose-100 text-rose-700",
      "bg-blue-100 text-blue-700",
      "bg-amber-100 text-amber-700",
      "bg-emerald-100 text-emerald-700",
      "bg-purple-100 text-purple-700",
      "bg-cyan-100 text-cyan-700",
      "bg-orange-100 text-orange-700",
      "bg-pink-100 text-pink-700",
    ];
    const map: Record<string, string> = {};
    venues.forEach((v, i) => {
      map[v.id] = colors[i % colors.length];
    });
    return map;
  }, [venues]);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 className="font-display text-lg font-semibold capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: es })}
        </h2>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            className="h-8 text-xs"
            onClick={() => setCurrentMonth(new Date())}
          >
            Hoy
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-4">
        {/* Week days header */}
        <div className="grid grid-cols-7 mb-2">
          {weekDays.map((day) => (
            <div key={day} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Days grid - bigger cells to show event names */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for offset */}
          {Array.from({ length: firstDayOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-24 bg-muted/20 rounded-lg" />
          ))}
          
          {days.map((day) => {
            const dayEvents = getEventsForDay(day);
            const hasEvents = dayEvents.length > 0;
            const totalPax = dayEvents.reduce((sum, e) => sum + (e.pax || 0), 0);
            
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-24 p-1.5 rounded-lg transition-all duration-200 hover:bg-accent/50 flex flex-col",
                  isToday(day) && "ring-2 ring-primary ring-offset-1",
                  hasEvents ? "bg-accent/30" : "bg-muted/20"
                )}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    "text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full",
                    isToday(day) && "bg-primary text-primary-foreground font-bold"
                  )}>
                    {format(day, "d")}
                  </span>
                  {hasEvents && (
                    <span className="text-[10px] text-muted-foreground">
                      {totalPax} pax
                    </span>
                  )}
                </div>
                
                {/* Event list */}
                <div className="flex-1 space-y-0.5 overflow-hidden">
                  {dayEvents.slice(0, 3).map((event) => (
                    <Tooltip key={event.id}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "text-[10px] leading-tight px-1 py-0.5 rounded truncate cursor-pointer hover:ring-1 hover:ring-primary/50 transition-all",
                            event.venue_id 
                              ? venueColors[event.venue_id] 
                              : "bg-muted text-muted-foreground"
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditEvent(event);
                          }}
                        >
                          {event.name}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <div className="space-y-1">
                          <p className="font-medium">{event.name}</p>
                          {event.venue && (
                            <p className="text-xs">Salón: {event.venue.name}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {event.pax} pax • {event.event_time || "Sin hora"}
                          </p>
                          {event.client_name && (
                            <p className="text-xs">Cliente: {event.client_name}</p>
                          )}
                          <p className="text-xs text-primary mt-1">Clic para editar</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {dayEvents.length > 3 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="text-[10px] text-muted-foreground px-1 cursor-pointer hover:text-foreground">
                          +{dayEvents.length - 3} más
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <div className="space-y-1">
                          <p className="font-medium">{format(day, "d MMMM", { locale: es })}</p>
                          <p className="text-xs text-muted-foreground">{dayEvents.length} eventos • {totalPax} pax</p>
                          <div className="space-y-1 pt-1 max-h-48 overflow-y-auto">
                            {dayEvents.map((event) => (
                              <div key={event.id} className="flex items-center gap-2 text-xs">
                                {event.venue && (
                                  <Badge variant="outline" className={cn("text-[10px] px-1 shrink-0", venueColors[event.venue_id || ""])}>
                                    {event.venue.name}
                                  </Badge>
                                )}
                                <span className="truncate flex-1">{event.name}</span>
                                <span className="text-muted-foreground flex items-center gap-0.5 shrink-0">
                                  <Users className="h-3 w-3" />
                                  {event.pax}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      {venues.length > 0 && (
        <div className="border-t border-border p-3">
          <div className="flex flex-wrap gap-2">
            {venues.slice(0, 8).map((venue) => (
              <div key={venue.id} className="flex items-center gap-1">
                <div className={cn("h-2 w-2 rounded-full", venueColors[venue.id]?.split(" ")[0])} />
                <span className="text-[10px] text-muted-foreground">{venue.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const Events = () => {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"calendar" | "list">("list");
  const [selectedVenue, setSelectedVenue] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventWithRelations | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [listLimit, setListLimit] = useState(30);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    event_date: format(new Date(), "yyyy-MM-dd"),
    event_time: "",
    venue_id: "",
    menu_id: "",
    pax: "",
    client_name: "",
    client_contact: "",
    notes: "",
    status: "confirmed",
  });

  // Los plannings importados pueden venir con fechas históricas (p.ej. 2025) o futuras.
  // Mostramos un rango amplio (año pasado → año siguiente) para que no “se corte” en abril.
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

  const filteredEvents = events.filter(event => {
    if (selectedVenue === "all") return true;
    return event.venue_id === selectedVenue;
  });

  const upcomingEvents = filteredEvents.slice(0, listLimit);
  const totalPax = filteredEvents.reduce((sum, e) => sum + (e.pax || 0), 0);
  const withMenu = filteredEvents.filter(e => e.menu_id).length;

  const resetForm = () => {
    setFormData({
      name: "",
      event_date: format(new Date(), "yyyy-MM-dd"),
      event_time: "",
      venue_id: "",
      menu_id: "",
      pax: "",
      client_name: "",
      client_contact: "",
      notes: "",
      status: "confirmed",
    });
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (event: EventWithRelations) => {
    setFormData({
      name: event.name,
      event_date: event.event_date,
      event_time: event.event_time || "",
      venue_id: event.venue_id || "",
      menu_id: event.menu_id || "",
      pax: event.pax?.toString() || "",
      client_name: event.client_name || "",
      client_contact: event.client_contact || "",
      notes: event.notes || "",
      status: event.status || "confirmed",
    });
    setEditingEvent(event);
  };

  const handleSubmit = async () => {
    const data = {
      name: formData.name,
      event_date: formData.event_date,
      event_time: formData.event_time || null,
      venue_id: formData.venue_id || null,
      menu_id: formData.menu_id || null,
      pax: formData.pax ? parseInt(formData.pax) : 0,
      client_name: formData.client_name || null,
      client_contact: formData.client_contact || null,
      notes: formData.notes || null,
      status: formData.status,
    };

    if (editingEvent) {
      await updateEvent.mutateAsync({ id: editingEvent.id, ...data });
      setEditingEvent(null);
    } else {
      await createEvent.mutateAsync(data);
      setIsCreateOpen(false);
    }
    resetForm();
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteEvent.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <MainLayout 
      title="Eventos" 
      subtitle="Calendario y gestión de eventos por salón"
    >
      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Rango mostrado</p>
          <p className="font-display text-2xl font-semibold mt-1">{filteredEvents.length}</p>
          <p className="text-xs text-muted-foreground">eventos</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Pax total</p>
          <p className="font-display text-2xl font-semibold mt-1">{totalPax.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">personas</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Con menú asignado</p>
          <p className="font-display text-2xl font-semibold mt-1">{withMenu}</p>
          <p className="text-xs text-muted-foreground">de {filteredEvents.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Salones activos</p>
          <p className="font-display text-2xl font-semibold mt-1">
            {new Set(filteredEvents.map(e => e.venue_id).filter(Boolean)).size}
          </p>
          <p className="text-xs text-muted-foreground">de {venues.length}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex rounded-lg border border-border p-1">
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="sm"
              className="h-8 px-3"
              onClick={() => setViewMode("calendar")}
            >
              <Calendar className="h-4 w-4 mr-1" />
              Calendario
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              className="h-8 px-3"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4 mr-1" />
              Lista
            </Button>
          </div>

          {/* Venue Filter */}
          <Select value={selectedVenue} onValueChange={setSelectedVenue}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="Todos los salones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los salones</SelectItem>
              {venues.map((venue) => (
                <SelectItem key={venue.id} value={venue.id}>{venue.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <EventsXLSXImport />
          <Button size="sm" className="h-9" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Evento
          </Button>
        </div>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : viewMode === "calendar" ? (
        <EventCalendarView 
          events={filteredEvents} 
          venues={venues}
          onEditEvent={handleOpenEdit}
          onDeleteEvent={(id) => setDeleteId(id)}
        />
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="p-4 border-b border-border">
            <h3 className="font-display text-lg font-semibold">Eventos</h3>
          </div>
          <div className="divide-y divide-border">
            {upcomingEvents.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No hay eventos próximos</p>
                <p className="text-sm">Importa desde Excel o crea uno nuevo</p>
              </div>
            ) : (
              upcomingEvents.map((event) => (
                <div key={event.id} className="p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium truncate">{event.name}</h4>
                        <Badge variant={event.status === "confirmed" ? "default" : "secondary"} className="text-xs">
                          {event.status === "confirmed" ? "Confirmado" : event.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(event.event_date), "EEE d MMM yyyy", { locale: es })}
                          {event.event_time && ` • ${event.event_time}`}
                        </span>
                        {event.venue && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {event.venue.name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {event.pax} pax
                        </span>
                      </div>
                      {event.menu && (
                        <p className="text-xs text-primary mt-1">Menú: {event.menu.name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleOpenEdit(event)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteId(event.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {filteredEvents.length > listLimit && (
            <div className="p-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setListLimit((v) => v + 50)}
              >
                Mostrar más ({filteredEvents.length - listLimit} restantes)
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="mt-6">
        <EventCostVarianceCard rows={costVariance} />
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen || !!editingEvent} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false);
          setEditingEvent(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Editar Evento" : "Nuevo Evento"}</DialogTitle>
            <DialogDescription>
              {editingEvent ? "Modifica los datos del evento" : "Añade un nuevo evento al calendario"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre del evento *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: Boda García-López"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="date">Fecha *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.event_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, event_date: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="time">Hora</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.event_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, event_time: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="venue">Salón</Label>
                <Select 
                  value={formData.venue_id} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, venue_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {venues.map((venue) => (
                      <SelectItem key={venue.id} value={venue.id}>
                        {venue.name} {venue.capacity && `(${venue.capacity} pax)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pax">PAX</Label>
                <Input
                  id="pax"
                  type="number"
                  value={formData.pax}
                  onChange={(e) => setFormData(prev => ({ ...prev, pax: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="menu">Menú</Label>
                <div className="flex items-center gap-2">
                  <MenuOCRImport 
                    onImport={(menuData) => {
                      // OCR import - mostramos datos en notas por ahora
                      const menuText = menuData.sections
                        .map(s => `${s.name}: ${s.items.map(i => i.name).join(", ")}`)
                        .join("\n");
                      setFormData(prev => ({
                        ...prev,
                        notes: prev.notes 
                          ? `${prev.notes}\n\n--- Menú OCR ---\n${menuText}`
                          : `--- Menú OCR ---\n${menuText}`
                      }));
                      toast({
                        title: "Menú importado",
                        description: "Los datos del menú se han añadido a las notas del evento",
                      });
                    }}
                  />
                  <AIMenuSuggestion
                    eventName={formData.name}
                    pax={parseInt(formData.pax) || 0}
                    eventType={formData.notes}
                  />
                </div>
              </div>
              <Select 
                value={formData.menu_id} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, menu_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar menú de BD..." />
                </SelectTrigger>
                <SelectContent>
                  {menus.map((menu) => (
                    <SelectItem key={menu.id} value={menu.id}>{menu.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Selecciona un menú existente o usa OCR para importar desde imagen
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="client">Cliente</Label>
                <Input
                  id="client"
                  value={formData.client_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, client_name: e.target.value }))}
                  placeholder="Nombre del cliente"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contact">Contacto</Label>
                <Input
                  id="contact"
                  value={formData.client_contact}
                  onChange={(e) => setFormData(prev => ({ ...prev, client_contact: e.target.value }))}
                  placeholder="Teléfono o email"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Observaciones adicionales..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateOpen(false);
              setEditingEvent(null);
              resetForm();
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.name || !formData.event_date || createEvent.isPending || updateEvent.isPending}
            >
              {(createEvent.isPending || updateEvent.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingEvent ? "Guardar cambios" : "Crear evento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El evento será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
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
