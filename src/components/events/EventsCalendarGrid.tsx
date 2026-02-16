import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isToday,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { EventWithRelations } from "@/hooks/useEvents";

interface EventsCalendarGridProps {
  events: EventWithRelations[];
  onEdit: (event: EventWithRelations) => void;
}

function displayPax(event: EventWithRelations): number {
  return event.pax_confirmed || event.pax_estimated || event.pax || 0;
}

export function EventsCalendarGrid({ events, onEdit }: EventsCalendarGridProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventWithRelations[]>();
    for (const event of events) {
      const key = event.event_date;
      const current = map.get(key) ?? [];
      current.push(event);
      map.set(key, current);
    }
    return map;
  }, [events]);

  const firstDayOffset = (getDay(startOfMonth(currentMonth)) + 6) % 7;
  const weekDays = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h3 className="font-display text-lg font-semibold capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: es })}
        </h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCurrentMonth(new Date())}>
            Hoy
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-7 mb-2">
          {weekDays.map((day) => (
            <div key={day} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDayOffset }).map((_, index) => (
            <div key={`offset-${index}`} className="min-h-24 rounded-lg bg-muted/20" />
          ))}

          {days.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDate.get(dayKey) ?? [];
            const totalPax = dayEvents.reduce((sum, event) => sum + displayPax(event), 0);
            const hasEvents = dayEvents.length > 0;

            return (
              <div
                key={dayKey}
                className={cn(
                  "min-h-24 rounded-lg border p-1.5",
                  hasEvents ? "border-primary/20 bg-primary/5" : "border-transparent bg-muted/20",
                  isToday(day) && "ring-2 ring-primary/50 ring-offset-1",
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className={cn("text-xs font-medium", isToday(day) && "text-primary")}>{format(day, "d")}</span>
                  {hasEvents && <span className="text-[10px] text-muted-foreground">{totalPax} pax</span>}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 2).map((event) => (
                    <Tooltip key={event.id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onEdit(event)}
                          className="w-full rounded bg-background px-1 py-0.5 text-left text-[10px] leading-tight hover:border-primary hover:ring-1 hover:ring-primary/30"
                        >
                          <div className="truncate">{event.name}</div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <div className="space-y-1">
                          <p className="font-medium">{event.name}</p>
                          <p className="text-xs text-muted-foreground">{displayPax(event)} pax</p>
                          <p className="text-xs">
                            {event.venue?.name || "Sin salon"}
                            {event.event_time ? ` - ${event.event_time.slice(0, 5)}` : ""}
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {dayEvents.length > 2 && (
                    <Badge variant="outline" className="h-5 text-[10px]">
                      +{dayEvents.length - 2} mas
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
