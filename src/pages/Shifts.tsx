import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Calendar, ChevronLeft, ChevronRight, Loader2, Moon, Sun, Sunset } from "lucide-react";
import { 
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDate,
  isWeekend,
  startOfMonth,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useEvents } from "@/hooks/useEvents";
import { useRequireHotel } from "@/hooks/useCurrentHotel";
import { useStaff, Staff } from "@/hooks/useStaff";
import {
  useDeleteStaffShiftAssignment,
  useStaffShiftAssignments,
  useUpsertStaffShiftAssignment,
} from "@/hooks/useStaffShiftAssignments";
import { dbShiftToUi, makeShiftKey, uiShiftToDb, UiShiftType } from "@/lib/staffShiftAssignments";

const Shifts = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const { hasHotel, error: hotelError } = useRequireHotel();
  const { data: staffList = [], isLoading: staffLoading } = useStaff();

  const roles = useMemo(() => {
    return [...new Set(staffList.map((s) => s.role))].sort((a, b) => a.localeCompare(b));
  }, [staffList]);

  const filteredStaff = useMemo(() => {
    if (roleFilter === "all") return staffList;
    return staffList.filter((s) => s.role === roleFilter);
  }, [roleFilter, staffList]);

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Fetch events for the current month
  const startDate = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const endDate = format(endOfMonth(currentMonth), "yyyy-MM-dd");
  const { data: events = [] } = useEvents({ startDate, endDate });

  const { data: shiftAssignments = [], isLoading: shiftsLoading } = useStaffShiftAssignments({
    startDate,
    endDate,
  });
  const upsertShift = useUpsertStaffShiftAssignment();
  const deleteShift = useDeleteStaffShiftAssignment();

  // Create a map of dates with events
  const eventsMap = useMemo(() => {
    const map = new Map<string, typeof events>();
    events.forEach(event => {
      const dateKey = event.event_date;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(event);
    });
    return map;
  }, [events]);

  // Split into two fortnights
  const firstFortnight = days.filter(d => getDate(d) <= 15);
  const secondFortnight = days.filter(d => getDate(d) > 15);

  const shiftsByKey = useMemo(() => {
    const map = new Map<string, (typeof shiftAssignments)[number]>();
    shiftAssignments.forEach((a) => {
      map.set(makeShiftKey(a.staff_id, a.shift_date), a);
    });
    return map;
  }, [shiftAssignments]);

  const getShiftIcon = (shift: UiShiftType | null) => {
    if (!shift) return null;
    switch (shift) {
      case "M": return <Sun className="h-3 w-3 text-warning" />;
      case "T": return <Sunset className="h-3 w-3 text-orange-500" />;
      case "N": return <Moon className="h-3 w-3 text-info" />;
    }
  };

  const getShiftColor = (shift: UiShiftType | null) => {
    if (!shift) return "";
    switch (shift) {
      case "M": return "bg-warning/20 text-warning-foreground";
      case "T": return "bg-orange-100 text-orange-700";
      case "N": return "bg-info/20 text-info-foreground";
    }
  };

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<{ staff: Staff; date: string } | null>(null);
  const [selectedShift, setSelectedShift] = useState<UiShiftType | null>(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const openEditor = (staff: Staff, date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const existing = shiftsByKey.get(makeShiftKey(staff.id, dateStr));

    setEditing({ staff, date: dateStr });
    setSelectedShift(existing ? dbShiftToUi(existing.shift_type) : null);
    setStartTime(existing?.start_time ? String(existing.start_time).slice(0, 5) : "");
    setEndTime(existing?.end_time ? String(existing.end_time).slice(0, 5) : "");
    setEditOpen(true);
  };

  const closeEditor = () => {
    setEditOpen(false);
    setEditing(null);
    setSelectedShift(null);
    setStartTime("");
    setEndTime("");
  };

  const saveShift = async () => {
    if (!editing) return;

    const existing = shiftsByKey.get(makeShiftKey(editing.staff.id, editing.date));
    if (!selectedShift) {
      if (existing) {
        await deleteShift.mutateAsync({ staffId: editing.staff.id, shiftDate: editing.date });
      }
      closeEditor();
      return;
    }

    const dbShift = uiShiftToDb(selectedShift);
    if (!dbShift) return;

    await upsertShift.mutateAsync({
      staff_id: editing.staff.id,
      shift_date: editing.date,
      shift_type: dbShift,
      start_time: startTime || null,
      end_time: endTime || null,
    });
    closeEditor();
  };

  const renderFortnightTable = (fortnight: Date[], label: string) => (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="p-3 border-b border-border bg-muted/30">
        <h3 className="font-medium text-sm">{label}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 bg-card p-2 text-left font-medium min-w-[150px]">
                Empleado
              </th>
              {fortnight.map((day) => {
                const dateKey = format(day, "yyyy-MM-dd");
                const dayEvents = eventsMap.get(dateKey) || [];
                const hasEvents = dayEvents.length > 0;
                
                return (
                  <th 
                    key={day.toISOString()} 
                    className={cn(
                      "p-2 text-center font-medium min-w-[36px] relative",
                      isWeekend(day) && "bg-muted/50"
                    )}
                  >
                    <div className="text-[10px] text-muted-foreground uppercase">
                      {format(day, "EEE", { locale: es }).slice(0, 1)}
                    </div>
                    <div className={cn(
                      "text-sm relative inline-flex items-center justify-center",
                      isWeekend(day) && "text-muted-foreground"
                    )}>
                      {format(day, "d")}
                      {hasEvents && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="absolute -top-0.5 -right-2 flex h-2.5 w-2.5 items-center justify-center">
                              <span className="absolute h-full w-full rounded-full bg-warning animate-ping opacity-75" />
                              <span className="relative h-2 w-2 rounded-full bg-warning" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Calendar className="h-3.5 w-3.5 text-warning" />
                              <span className="font-medium">{dayEvents.length} evento{dayEvents.length > 1 ? "s" : ""}</span>
                            </div>
                            <ul className="text-xs space-y-0.5">
                              {dayEvents.slice(0, 3).map(ev => (
                                <li key={ev.id} className="truncate">
                                  • {ev.name} ({ev.pax} pax)
                                </li>
                              ))}
                              {dayEvents.length > 3 && (
                                <li className="text-muted-foreground">+{dayEvents.length - 3} más</li>
                              )}
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredStaff.map((staff) => (
              <tr key={staff.id} className="border-b border-border last:border-0">
                <td className="sticky left-0 bg-card p-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {staff.full_name.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{staff.full_name}</p>
                      <p className="text-[10px] text-muted-foreground">{staff.role}</p>
                    </div>
                  </div>
                </td>
                {fortnight.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const assignment = shiftsByKey.get(makeShiftKey(staff.id, dateStr));
                  const shift = assignment ? dbShiftToUi(assignment.shift_type) : null;
                  return (
                    <td 
                      key={day.toISOString()} 
                      className={cn(
                        "p-1 text-center",
                        isWeekend(day) && "bg-muted/50"
                      )}
                    >
                      <button
                        type="button"
                        className={cn(
                          "h-6 w-6 mx-auto rounded flex items-center justify-center transition-colors",
                          shift ? getShiftColor(shift) : "hover:bg-muted/60"
                        )}
                        onClick={() => openEditor(staff, day)}
                      >
                        {shift ? getShiftIcon(shift) : null}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <MainLayout 
      title="Turnos" 
      subtitle="Vista doble quincena"
    >
      {!hasHotel ? (
        <div className="flex h-[50vh] items-center justify-center">
          <div className="text-center">
            <h3 className="font-display text-xl font-semibold mb-2">Sin hotel seleccionado</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {hotelError || "Debes crear o seleccionar un hotel para gestionar los turnos"}
            </p>
          </div>
        </div>
      ) : staffLoading || shiftsLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : staffList.length === 0 ? (
        <div className="flex h-[50vh] items-center justify-center rounded-2xl border border-dashed border-border">
          <div className="text-center">
            <h3 className="font-display text-xl font-semibold mb-2">Sin personal registrado</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Añade empleados en el módulo Personal para poder asignar turnos.
            </p>
          </div>
        </div>
      ) : (
        <>
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          {/* Month Navigation */}
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-display text-lg font-semibold capitalize min-w-[150px] text-center">
              {format(currentMonth, "MMMM yyyy", { locale: es })}
            </span>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Role Filter */}
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue placeholder="Rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-sm text-muted-foreground">Toca una celda para asignar un turno</p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-6 p-3 rounded-lg bg-muted/30">
        <span className="text-sm font-medium">Leyenda:</span>
        <div className="flex items-center gap-2">
          <div className={cn("flex items-center justify-center h-6 w-6 rounded", getShiftColor("M"))}>
            <Sun className="h-3 w-3" />
          </div>
          <span className="text-sm">Mañana</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("flex items-center justify-center h-6 w-6 rounded", getShiftColor("T"))}>
            <Sunset className="h-3 w-3" />
          </div>
          <span className="text-sm">Tarde</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("flex items-center justify-center h-6 w-6 rounded", getShiftColor("N"))}>
            <Moon className="h-3 w-3" />
          </div>
          <span className="text-sm">Noche</span>
        </div>
        <div className="flex items-center gap-2 ml-4 pl-4 border-l border-border">
          <span className="relative flex h-2.5 w-2.5">
            <span className="h-2 w-2 rounded-full bg-warning" />
          </span>
          <span className="text-sm">Día con evento</span>
        </div>
      </div>

      {/* Double Fortnight View */}
      <div className="space-y-6">
        {renderFortnightTable(firstFortnight, "Primera Quincena (1-15)")}
        {renderFortnightTable(secondFortnight, "Segunda Quincena (16-" + days.length + ")")}
      </div>
        </>
      )}

      <Dialog open={editOpen} onOpenChange={(open) => (open ? null : closeEditor())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar turno</DialogTitle>
            <DialogDescription>
              {editing ? `${editing.staff.full_name} - ${editing.date}` : "Selecciona una celda"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Turno</Label>
              <Select
                value={selectedShift ?? "none"}
                onValueChange={(v) => setSelectedShift(v === "none" ? null : (v as UiShiftType))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona turno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin turno</SelectItem>
                  <SelectItem value="M">Mañana</SelectItem>
                  <SelectItem value="T">Tarde</SelectItem>
                  <SelectItem value="N">Noche</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hora inicio</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Hora fin</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
            <Button variant="outline" onClick={closeEditor} disabled={upsertShift.isPending || deleteShift.isPending}>
              Cancelar
            </Button>
            <Button onClick={saveShift} disabled={upsertShift.isPending || deleteShift.isPending || !editing}>
              {(upsertShift.isPending || deleteShift.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Shifts;
