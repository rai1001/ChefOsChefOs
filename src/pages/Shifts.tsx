import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { ChevronLeft, ChevronRight, Plus, Sun, Moon, Sunset, Calendar } from "lucide-react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  addMonths, 
  subMonths,
  getDate,
  isWeekend
} from "date-fns";
import { es } from "date-fns/locale";
import { employeesStore } from "@/lib/stores";
import { ShiftType, Employee } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useEvents } from "@/hooks/useEvents";

// Mock shift assignments for demo
const mockShiftAssignments: Record<string, ShiftType | null> = {};

const Shifts = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

  const employees = employeesStore.getAll();
  const departments = [...new Set(employees.map(e => e.department))];

  const filteredEmployees = departmentFilter === "all" 
    ? employees 
    : employees.filter(e => e.department === departmentFilter);

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Fetch events for the current month
  const startDate = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const endDate = format(endOfMonth(currentMonth), "yyyy-MM-dd");
  const { data: events = [] } = useEvents({ startDate, endDate });

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

  const getShiftIcon = (shift: ShiftType | null) => {
    if (!shift) return null;
    switch (shift) {
      case "M": return <Sun className="h-3 w-3 text-warning" />;
      case "T": return <Sunset className="h-3 w-3 text-orange-500" />;
      case "N": return <Moon className="h-3 w-3 text-info" />;
    }
  };

  const getShiftColor = (shift: ShiftType | null) => {
    if (!shift) return "";
    switch (shift) {
      case "M": return "bg-warning/20 text-warning-foreground";
      case "T": return "bg-orange-100 text-orange-700";
      case "N": return "bg-info/20 text-info-foreground";
    }
  };

  // Generate random shifts for demo
  const getShift = (employeeId: string, date: Date): ShiftType | null => {
    const key = `${employeeId}-${format(date, "yyyy-MM-dd")}`;
    if (mockShiftAssignments[key] !== undefined) {
      return mockShiftAssignments[key];
    }
    if (isWeekend(date)) {
      return Math.random() > 0.7 ? (["M", "T", "N"][Math.floor(Math.random() * 3)] as ShiftType) : null;
    }
    return Math.random() > 0.2 ? (["M", "T", "N"][Math.floor(Math.random() * 3)] as ShiftType) : null;
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
            {filteredEmployees.map((employee) => (
              <tr key={employee.id} className="border-b border-border last:border-0">
                <td className="sticky left-0 bg-card p-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {employee.name.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{employee.name}</p>
                      <p className="text-[10px] text-muted-foreground">{employee.role}</p>
                    </div>
                  </div>
                </td>
                {fortnight.map((day) => {
                  const shift = getShift(employee.id, day);
                  return (
                    <td 
                      key={day.toISOString()} 
                      className={cn(
                        "p-1 text-center",
                        isWeekend(day) && "bg-muted/50"
                      )}
                    >
                      {shift ? (
                        <div className={cn(
                          "flex items-center justify-center h-6 w-6 mx-auto rounded",
                          getShiftColor(shift)
                        )}>
                          {getShiftIcon(shift)}
                        </div>
                      ) : (
                        <div className="h-6 w-6 mx-auto" />
                      )}
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

          {/* Department Filter */}
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button size="sm" className="h-9">
          <Plus className="h-4 w-4 mr-2" />
          Asignar Turnos
        </Button>
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
    </MainLayout>
  );
};

export default Shifts;
