import { useState, useMemo } from "react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday,
  parseISO,
  getDay
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Event, HALLS, Hall } from "@/lib/types";
import { eventsStore } from "@/lib/stores";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const hallColors: Record<Hall, string> = {
  ROSALIA: "bg-rose-100 text-rose-700 border-rose-200",
  PONDAL: "bg-blue-100 text-blue-700 border-blue-200",
  CASTELAO: "bg-amber-100 text-amber-700 border-amber-200",
  CURROS: "bg-emerald-100 text-emerald-700 border-emerald-200",
  CUNQUEIRO: "bg-purple-100 text-purple-700 border-purple-200",
  HALL: "bg-slate-100 text-slate-700 border-slate-200",
  RESTAURANTE: "bg-orange-100 text-orange-700 border-orange-200",
  BAR: "bg-cyan-100 text-cyan-700 border-cyan-200",
};

interface EventCalendarProps {
  onDateSelect?: (date: Date, events: Event[]) => void;
  selectedHall?: Hall | "all";
}

export function EventCalendar({ onDateSelect, selectedHall = "all" }: EventCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const allEvents = eventsStore.getAll();
  
  const filteredEvents = useMemo(() => {
    if (selectedHall === "all") return allEvents;
    return allEvents.filter(e => e.hall === selectedHall);
  }, [allEvents, selectedHall]);

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Get first day offset (Monday = 0)
  const firstDayOffset = (getDay(startOfMonth(currentMonth)) + 6) % 7;
  
  const getEventsForDay = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return filteredEvents.filter(e => e.event_date === dateStr);
  };

  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

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

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for offset */}
          {Array.from({ length: firstDayOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}
          
          {days.map((day) => {
            const dayEvents = getEventsForDay(day);
            const hasEvents = dayEvents.length > 0;
            const totalPax = dayEvents.reduce((sum, e) => sum + (e.attendees || 0), 0);
            
            return (
              <Tooltip key={day.toISOString()}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onDateSelect?.(day, dayEvents)}
                    className={cn(
                      "aspect-square p-1 rounded-lg transition-all duration-200 hover:bg-accent/50 flex flex-col items-center justify-start relative",
                      isToday(day) && "ring-2 ring-primary ring-offset-1",
                      hasEvents && "bg-accent/30"
                    )}
                  >
                    <span className={cn(
                      "text-sm font-medium",
                      isToday(day) && "text-primary font-bold"
                    )}>
                      {format(day, "d")}
                    </span>
                    
                    {hasEvents && (
                      <div className="flex flex-wrap gap-0.5 mt-0.5 justify-center">
                        {dayEvents.slice(0, 3).map((event, idx) => (
                          <div
                            key={`${event.id}-${idx}`}
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              hallColors[event.hall].split(" ")[0]
                            )}
                          />
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[8px] text-muted-foreground">
                            +{dayEvents.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                </TooltipTrigger>
                {hasEvents && (
                  <TooltipContent side="right" className="max-w-xs">
                    <div className="space-y-1">
                      <p className="font-medium">{format(day, "d MMMM", { locale: es })}</p>
                      <p className="text-xs text-muted-foreground">{dayEvents.length} eventos • {totalPax} pax</p>
                      <div className="space-y-1 pt-1">
                        {dayEvents.map((event, idx) => (
                          <div key={`${event.id}-${idx}`} className="flex items-center gap-2 text-xs">
                            <Badge variant="outline" className={cn("text-[10px] px-1", hallColors[event.hall])}>
                              {event.hall}
                            </Badge>
                            <span className="truncate">{event.name}</span>
                            {event.attendees && (
                              <span className="text-muted-foreground flex items-center gap-0.5">
                                <Users className="h-3 w-3" />
                                {event.attendees}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="border-t border-border p-3">
        <div className="flex flex-wrap gap-2">
          {HALLS.map((hall) => (
            <div key={hall} className="flex items-center gap-1">
              <div className={cn("h-2 w-2 rounded-full", hallColors[hall].split(" ")[0])} />
              <span className="text-[10px] text-muted-foreground">{hall}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
